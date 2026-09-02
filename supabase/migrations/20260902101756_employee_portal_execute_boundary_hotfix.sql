create or replace function public.tibaldo_app_employee_portal_v1(
  period_start date default null,
  period_end date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := (select auth.uid());
begin
  if caller_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tibaldo_app_memberships m
    join public.tibaldo_app_employee_profiles p on p.user_id = m.user_id
    where m.user_id = caller_uid
      and m.role = 'EMPLOYEE'
      and p.active
      and p.status = 'ACTIVE'
  ) then
    raise exception 'active employee membership required' using errcode = '42501';
  end if;

  return private.tibaldo_app_employee_portal_v1_private(period_start, period_end);
end
$$;

revoke all on function private.tibaldo_app_employee_portal_v1_private(date, date)
  from public, anon, authenticated;

revoke all on function public.tibaldo_app_employee_portal_v1(date, date)
  from public, anon;
grant execute on function public.tibaldo_app_employee_portal_v1(date, date)
  to authenticated;
