create or replace function private.tibaldo_app_employee_portal_v1_private(
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
  current_person uuid;
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select private.tibaldo_app_current_person_id() into current_person;
  if current_person is null then
    raise exception 'active employee membership required' using errcode = '42501';
  end if;

  with scoped_entries as (
    select h.*, coalesce(p.name,
      case when h.business_classification = 'NO_PROPERTY_REQUIRED' then 'Sans logement requis'
           else nullif(h.property, '') end,
      'Sans logement requis') as property_label
    from public.housekeeping_entries h
    left join public.airbnb_properties p on p.id = h.property_id
    where h.person_id = current_person
      and h.source_system = 'google_forms_sheet'
      and (period_start is null or h.service_date >= period_start)
      and (period_end is null or h.service_date <= period_end)
  ),
  all_entries as (
    select * from public.housekeeping_entries h
    where h.person_id = current_person and h.source_system = 'google_forms_sheet'
  ),
  scoped_payments as (
    select * from public.cleaner_payments c
    where c.person_id = current_person
      and c.source_system = 'production_snapshot_2026-09-01'
      and (period_start is null or c.payment_date >= period_start)
      and (period_end is null or c.payment_date <= period_end)
  ),
  all_payments as (
    select * from public.cleaner_payments c
    where c.person_id = current_person and c.source_system = 'production_snapshot_2026-09-01'
  )
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'display_name', ep.display_name,
      'account_status', case when ep.active and ep.status = 'ACTIVE' then 'ACTIVE' else 'DISABLED' end
    ),
    'period', jsonb_build_object('start', period_start, 'end', period_end),
    'period_summary', jsonb_build_object(
      'minutes', coalesce((select sum(minutes) from scoped_entries), 0),
      'hours', round(coalesce((select sum(minutes) from scoped_entries), 0)::numeric / 60, 2),
      'linen_pairs', coalesce((select sum(linen_pairs) from scoped_entries), 0),
      'due_work', coalesce((select sum(due_work_amount) from scoped_entries), 0),
      'due_laundry', coalesce((select sum(due_laundry_amount) from scoped_entries), 0),
      'due_other', coalesce((select sum(due_purchase_amount) from scoped_entries), 0),
      'total_due', coalesce((select sum(due_total_amount) from scoped_entries), 0),
      'paid', coalesce((select sum(amount) from scoped_payments where payment_kind <> 'EXPENSE_REIMBURSEMENT'), 0)
    ),
    'balance', jsonb_build_object(
      'total_due', coalesce((select sum(due_total_amount) from all_entries), 0),
      'paid_and_adjustments', coalesce((select sum(amount) from all_payments where payment_kind <> 'EXPENSE_REIMBURSEMENT'), 0),
      'excluded_reimbursements', coalesce((select sum(amount) from all_payments where payment_kind = 'EXPENSE_REIMBURSEMENT'), 0),
      'current', coalesce((select sum(due_total_amount) from all_entries), 0)
        - coalesce((select sum(amount) from all_payments where payment_kind <> 'EXPENSE_REIMBURSEMENT'), 0)
    ),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'service_date', service_date,
      'property', property_label,
      'service_type', service_type,
      'minutes', minutes,
      'linen_pairs', linen_pairs,
      'due_work', due_work_amount,
      'due_laundry', due_laundry_amount,
      'due_other', due_purchase_amount,
      'total_due', due_total_amount,
      'mission', mission_description,
      'remarks', remarks,
      'mapping_status', mapping_status,
      'provenance', 'Saisi via formulaire'
    ) order by service_date desc) from scoped_entries), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
      'payment_date', payment_date,
      'amount', amount,
      'kind', payment_kind,
      'note', note,
      'balance_included', payment_kind <> 'EXPENSE_REIMBURSEMENT',
      'label', case
        when payment_kind = 'LEGACY_ADJUSTMENT' then 'Ajustement historique — origine non démontrée'
        when payment_kind = 'EXPENSE_REIMBURSEMENT' then 'Remboursement de frais — hors salaire'
        else 'Paiement salaire' end
    ) order by payment_date desc, created_at desc) from scoped_payments), '[]'::jsonb)
  ) into result
  from public.tibaldo_app_employee_profiles ep
  where ep.id = current_person;

  return result;
end
$$;

create or replace function public.tibaldo_app_employee_portal_v1(
  period_start date default null,
  period_end date default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.tibaldo_app_employee_portal_v1_private($1, $2)
$$;

revoke all on function private.tibaldo_app_employee_portal_v1_private(date, date) from public;
revoke all on function private.tibaldo_app_employee_portal_v1_private(date, date) from anon;
revoke all on function private.tibaldo_app_employee_portal_v1_private(date, date) from authenticated;
revoke all on function public.tibaldo_app_employee_portal_v1(date, date) from public;
revoke all on function public.tibaldo_app_employee_portal_v1(date, date) from anon;
grant execute on function public.tibaldo_app_employee_portal_v1(date, date) to authenticated;
