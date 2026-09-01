-- Bind RPC arguments positionally so an explicit request for another person
-- returns zero rows instead of falling back to the caller's own rows.
create or replace function private.tibaldo_app_person_entries_private(requested_person_id uuid default null)
returns setof public.housekeeping_entries language sql stable security definer set search_path = '' as $$
  select e.* from public.housekeeping_entries e
  where e.person_id is not null
    and private.tibaldo_app_can_read_person(e.person_id)
    and ($1 is null or e.person_id = $1)
  order by e.service_date desc, e.created_at desc
$$;

create or replace function public.tibaldo_app_person_entries(requested_person_id uuid default null)
returns setof public.housekeeping_entries language sql stable security invoker set search_path = '' as $$
  select * from private.tibaldo_app_person_entries_private($1)
$$;

create or replace function private.tibaldo_app_person_payments_private(requested_person_id uuid default null)
returns setof public.cleaner_payments language sql stable security definer set search_path = '' as $$
  select p.* from public.cleaner_payments p
  where p.person_id is not null
    and private.tibaldo_app_can_read_person(p.person_id)
    and ($1 is null or p.person_id = $1)
  order by p.payment_date desc, p.created_at desc
$$;

create or replace function public.tibaldo_app_person_payments(requested_person_id uuid default null)
returns setof public.cleaner_payments language sql stable security invoker set search_path = '' as $$
  select * from private.tibaldo_app_person_payments_private($1)
$$;
