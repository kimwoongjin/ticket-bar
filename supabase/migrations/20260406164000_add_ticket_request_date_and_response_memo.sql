alter table public.ticket_requests
add column if not exists requested_for_date date;

alter table public.ticket_requests
add column if not exists response_memo text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ticket_requests_response_memo_length'
  ) then
    alter table public.ticket_requests
    add constraint ticket_requests_response_memo_length
    check (response_memo is null or char_length(response_memo) <= 300);
  end if;
end
$$;
