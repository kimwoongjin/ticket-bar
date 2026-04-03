alter table public.tickets
add column if not exists title text;

update public.tickets
set title = '기본 티켓'
where title is null;

alter table public.tickets
alter column title set not null;

alter table public.tickets
alter column title set default '기본 티켓';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tickets_title_not_blank'
  ) then
    alter table public.tickets
    add constraint tickets_title_not_blank check (char_length(btrim(title)) > 0);
  end if;
end
$$;
