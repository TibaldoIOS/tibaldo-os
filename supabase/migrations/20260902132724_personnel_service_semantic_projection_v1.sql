-- Local-only draft. Do not apply while the shared Personnel ledger is frozen.
-- Exposes only allowlisted semantic lineage; raw source payloads and hashes stay private.

create or replace function private.tibaldo_app_safe_service_subtype(
  canonical_type text,
  source_payload jsonb
) returns text
language sql immutable security invoker set search_path = '' as $$
  select case
    when canonical_type = 'MISC_SERVICE'
      and source_payload ->> 'Type de prestations' = '💬 Service client - Mission'
    then 'SERVICE_CLIENT'
    else null
  end
$$;

create or replace function private.tibaldo_app_safe_source_property_context(
  canonical_property text,
  canonical_property_id uuid,
  current_mapping_status text,
  raw_primary text,
  raw_secondary text
) returns text
language sql immutable security invoker set search_path = '' as $$
  select case
    when canonical_property is null
      and canonical_property_id is null
      and current_mapping_status = 'NO_PROPERTY_REQUIRED'
      and coalesce(nullif(raw_primary, ''), nullif(raw_secondary, '')) = 'Tibado House'
    then 'Tibado House'
    else null
  end
$$;

create or replace function private.tibaldo_app_person_entries_v2_private(requested_person_id uuid default null)
returns table (
  id uuid,
  person_id uuid,
  service_date date,
  source_submitted_at timestamptz,
  property text,
  service_type text,
  semantic_subtype text,
  source_property_context text,
  minutes integer,
  linen_pairs integer,
  due_purchase_amount numeric,
  due_total_amount numeric,
  mission_description text,
  remarks text,
  mapping_status text
)
language sql stable security definer set search_path = '' as $$
  select
    h.id,
    h.person_id,
    h.service_date,
    h.source_submitted_at,
    h.property,
    h.service_type,
    private.tibaldo_app_safe_service_subtype(h.service_type, h.source_payload),
    private.tibaldo_app_safe_source_property_context(
      h.property, h.property_id, h.mapping_status,
      h.raw_property_primary, h.raw_property_secondary
    ),
    h.minutes,
    h.linen_pairs,
    h.due_purchase_amount,
    h.due_total_amount,
    h.mission_description,
    h.remarks,
    h.mapping_status
  from public.housekeeping_entries h
  where h.person_id is not null
    and private.tibaldo_app_can_read_person(h.person_id)
    and (requested_person_id is null or h.person_id = requested_person_id)
  order by h.service_date desc, h.source_submitted_at desc nulls last, h.id desc
$$;

create or replace function public.tibaldo_app_person_entries_v2(requested_person_id uuid default null)
returns table (
  id uuid,
  person_id uuid,
  service_date date,
  source_submitted_at timestamptz,
  property text,
  service_type text,
  semantic_subtype text,
  source_property_context text,
  minutes integer,
  linen_pairs integer,
  due_purchase_amount numeric,
  due_total_amount numeric,
  mission_description text,
  remarks text,
  mapping_status text
)
language sql stable security definer set search_path = '' as $$
  select * from private.tibaldo_app_person_entries_v2_private(requested_person_id)
$$;

create or replace function private.tibaldo_app_employee_portal_v1_private(
  period_start date default null,
  period_end date default null
)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
    select h.*, coalesce(p.name, nullif(h.property, '')) as property_label,
      private.tibaldo_app_safe_service_subtype(h.service_type, h.source_payload) as semantic_subtype,
      private.tibaldo_app_safe_source_property_context(
        h.property, h.property_id, h.mapping_status,
        h.raw_property_primary, h.raw_property_secondary
      ) as source_property_context
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
      'source_submitted_at', source_submitted_at,
      'property', property_label,
      'source_property_context', source_property_context,
      'service_type', service_type,
      'semantic_subtype', semantic_subtype,
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
    ) order by service_date desc, source_submitted_at desc nulls last, id desc) from scoped_entries), '[]'::jsonb),
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

revoke all on function private.tibaldo_app_safe_service_subtype(text, jsonb) from public, anon, authenticated;
revoke all on function private.tibaldo_app_safe_source_property_context(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.tibaldo_app_person_entries_v2_private(uuid) from public, anon, authenticated;
revoke all on function public.tibaldo_app_person_entries_v2(uuid) from public, anon;
grant execute on function public.tibaldo_app_person_entries_v2(uuid) to authenticated;
