create extension if not exists pgcrypto;

create type public.auth_provider as enum ('google', 'email');
create type public.couple_status as enum ('pending', 'active', 'inactive');
create type public.couple_role as enum ('issuer', 'receiver');
create type public.timeout_action as enum ('auto_approve', 'auto_reject', 'return');
create type public.auto_issue_cycle as enum ('weekly', 'monthly', 'none');
create type public.ticket_status as enum ('available', 'requested', 'used', 'expired');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'returned');

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  avatar_url text,
  auth_provider public.auth_provider not null,
  created_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  status public.couple_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint couples_invite_code_format check (invite_code ~ '^TB-[0-9]{4}$')
);

create table public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.couple_role not null,
  joined_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null unique references public.couples (id) on delete cascade,
  timeout_hours integer not null default 24,
  timeout_action public.timeout_action not null default 'return',
  auto_issue_cycle public.auto_issue_cycle not null default 'none',
  auto_issue_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint rules_timeout_hours_positive check (timeout_hours > 0),
  constraint rules_auto_issue_count_non_negative check (auto_issue_count >= 0)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  issued_by uuid not null references public.users (id) on delete restrict,
  status public.ticket_status not null default 'available',
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ticket_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  requested_by uuid not null references public.users (id) on delete restrict,
  status public.request_status not null default 'pending',
  memo text,
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ticket_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  request_id uuid not null unique references public.ticket_requests (id) on delete cascade,
  memo text,
  emoji_reaction text,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index idx_couple_members_user_id on public.couple_members (user_id);
create index idx_couple_members_couple_id on public.couple_members (couple_id);
create index idx_tickets_couple_id_status on public.tickets (couple_id, status);
create index idx_tickets_expires_at on public.tickets (expires_at);
create index idx_ticket_requests_ticket_id on public.ticket_requests (ticket_id);
create index idx_ticket_requests_status_expires_at on public.ticket_requests (status, expires_at);
create index idx_ticket_logs_ticket_id_created_at on public.ticket_logs (ticket_id, created_at desc);
create index idx_push_subscriptions_user_id on public.push_subscriptions (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_rules_set_updated_at
before update on public.rules
for each row
execute function public.set_updated_at();

create or replace function public.current_user_couple_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select cm.couple_id
  from public.couple_members cm
  where cm.user_id = auth.uid();
$$;

create or replace function public.is_current_user_issuer(target_couple_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = target_couple_id
      and cm.user_id = auth.uid()
      and cm.role = 'issuer'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text;
  display_name text;
begin
  provider := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  display_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, email, name, auth_provider)
  values (
    new.id,
    new.email,
    display_name,
    case
      when provider = 'google' then 'google'::public.auth_provider
      else 'email'::public.auth_provider
    end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.rules enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_requests enable row level security;
alter table public.ticket_logs enable row level security;
alter table public.push_subscriptions enable row level security;

create policy users_select_own on public.users
for select
using (id = auth.uid());

create policy users_insert_own on public.users
for insert
with check (id = auth.uid());

create policy users_update_own on public.users
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy couples_select_member on public.couples
for select
using (id in (select public.current_user_couple_ids()));

create policy couples_insert_authenticated on public.couples
for insert
with check (auth.uid() is not null);

create policy couples_update_issuer on public.couples
for update
using (public.is_current_user_issuer(id))
with check (public.is_current_user_issuer(id));

create policy couple_members_select_member on public.couple_members
for select
using (couple_id in (select public.current_user_couple_ids()));

create policy couple_members_insert_self on public.couple_members
for insert
with check (
  user_id = auth.uid()
  and (
    role = 'issuer'::public.couple_role
    or couple_id in (select public.current_user_couple_ids())
  )
);

create policy rules_select_member on public.rules
for select
using (couple_id in (select public.current_user_couple_ids()));

create policy rules_insert_issuer on public.rules
for insert
with check (public.is_current_user_issuer(couple_id));

create policy rules_update_issuer on public.rules
for update
using (public.is_current_user_issuer(couple_id))
with check (public.is_current_user_issuer(couple_id));

create policy tickets_select_member on public.tickets
for select
using (couple_id in (select public.current_user_couple_ids()));

create policy tickets_insert_issuer on public.tickets
for insert
with check (public.is_current_user_issuer(couple_id) and issued_by = auth.uid());

create policy tickets_update_member on public.tickets
for update
using (couple_id in (select public.current_user_couple_ids()))
with check (couple_id in (select public.current_user_couple_ids()));

create policy ticket_requests_select_member on public.ticket_requests
for select
using (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.couple_id in (select public.current_user_couple_ids())
  )
);

create policy ticket_requests_insert_receiver on public.ticket_requests
for insert
with check (
  requested_by = auth.uid()
  and exists (
    select 1
    from public.tickets t
    join public.couple_members cm
      on cm.couple_id = t.couple_id
    where t.id = ticket_id
      and cm.user_id = auth.uid()
      and cm.role = 'receiver'::public.couple_role
  )
);

create policy ticket_requests_update_issuer on public.ticket_requests
for update
using (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and public.is_current_user_issuer(t.couple_id)
  )
)
with check (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and public.is_current_user_issuer(t.couple_id)
  )
);

create policy ticket_logs_select_member on public.ticket_logs
for select
using (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and t.couple_id in (select public.current_user_couple_ids())
  )
);

create policy ticket_logs_insert_issuer on public.ticket_logs
for insert
with check (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and public.is_current_user_issuer(t.couple_id)
  )
);

create policy push_subscriptions_select_own on public.push_subscriptions
for select
using (user_id = auth.uid());

create policy push_subscriptions_insert_own on public.push_subscriptions
for insert
with check (user_id = auth.uid());

create policy push_subscriptions_update_own on public.push_subscriptions
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy push_subscriptions_delete_own on public.push_subscriptions
for delete
using (user_id = auth.uid());
