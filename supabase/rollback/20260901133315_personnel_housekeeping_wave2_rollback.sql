-- Bounded TEST-only rollback for Personnel × Ménage Wave 2.
begin;

update public.housekeeping_entries e
set property_id=(b.state->>'property_id')::uuid,
    property=b.state->>'property',
    mapping_status=b.state->>'mapping_status',
    business_classification=b.state->>'business_classification'
from public.tibaldo_app_wave2_mapping_backup b
where b.entity_type='HOUSEKEEPING_ENTRY' and b.entity_id=e.id::text;

update public.cleaner_payments p
set id=(b.state->>'id')::uuid,
    payment_kind=b.state->>'payment_kind',
    legacy_classification=b.state->>'legacy_classification'
from public.tibaldo_app_wave2_mapping_backup b
where b.entity_type='PAYMENT'
  and p.cleaner_name='Jennifer' and p.amount=-91.50
  and p.payment_date=date '2026-08-03' and p.note='Ajustement historique Jennifer';

update public.tibaldo_app_property_aliases a
set canonical_property_id=(b.state->>'canonical_property_id')::uuid,
    canonical_business_label=b.state->>'canonical_business_label',
    status=b.state->>'status',
    owner_review_required=(b.state->>'owner_review_required')::boolean,
    updated_at=(b.state->>'updated_at')::timestamptz
from public.tibaldo_app_wave2_mapping_backup b
where b.entity_type='PROPERTY_ALIAS' and b.entity_id=a.id::text;

delete from public.airbnb_properties p
where lower(p.name)='gare'
  and not exists (select 1 from public.housekeeping_entries e where e.property_id=p.id)
  and not exists (select 1 from public.tibaldo_app_property_aliases a where a.canonical_property_id=p.id);

drop function if exists public.tibaldo_app_sync_housekeeping_row(text,text,jsonb);
drop function if exists public.tibaldo_app_resolve_property_mapping(uuid,text,text,text);
drop function if exists private.tibaldo_app_resolve_property_mapping_private(uuid,text,text,text);
drop table if exists public.tibaldo_app_property_mapping_decisions;
drop table if exists public.tibaldo_app_personnel_audit_events;
drop table if exists public.tibaldo_app_wave2_mapping_backup;

commit;
