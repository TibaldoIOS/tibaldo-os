-- TEST/private-beta rollback only. Historical imported rows are identified by
-- source_system/import_batch_id. Never run this against production.
begin;

delete from public.housekeeping_entries
where source_system = 'google_forms_sheet';

delete from public.cleaner_payments
where source_system = 'production_snapshot_2026-09-01';

delete from public.tibaldo_app_person_aliases
where source_system = 'google_forms_sheet';

delete from public.tibaldo_app_property_aliases
where source_system = 'google_forms_sheet';

delete from public.tibaldo_app_employee_profiles
where staff_key in ('gaelle','jennifer','rachida') and user_id is null;

drop function if exists public.tibaldo_app_record_payment(uuid,numeric,date,text,text,text);
drop function if exists public.tibaldo_app_person_payments(uuid);
drop function if exists public.tibaldo_app_person_entries(uuid);
drop function if exists public.tibaldo_app_personnel_balances();
drop function if exists private.tibaldo_app_record_payment_private(uuid,numeric,date,text,text,text);
drop function if exists private.tibaldo_app_person_payments_private(uuid);
drop function if exists private.tibaldo_app_person_entries_private(uuid);
drop function if exists private.tibaldo_app_personnel_balances_private();
drop function if exists private.tibaldo_app_can_read_person(uuid);
drop function if exists private.tibaldo_app_current_person_id();

drop table if exists public.tibaldo_app_housekeeping_import_batches;
drop table if exists public.tibaldo_app_property_aliases;
drop table if exists public.tibaldo_app_person_aliases;

drop index if exists public.cleaner_payments_person_date_idx;
drop index if exists public.cleaner_payments_source_identity_uidx;
drop index if exists public.cleaner_payments_created_by_idx;
alter table public.cleaner_payments
  drop column if exists import_batch_id,
  drop column if exists source_record_id,
  drop column if exists source_system,
  drop column if exists legacy_classification,
  drop column if exists external_reference,
  drop column if exists payment_kind,
  drop column if exists created_by,
  drop column if exists person_id;

drop index if exists public.housekeeping_entries_property_service_date_idx;
drop index if exists public.housekeeping_entries_person_service_date_idx;
drop index if exists public.housekeeping_entries_source_identity_uidx;
alter table public.housekeeping_entries
  drop column if exists import_batch_id,
  drop column if exists business_classification,
  drop column if exists mapping_status,
  drop column if exists due_total_amount,
  drop column if exists due_purchase_amount,
  drop column if exists due_laundry_amount,
  drop column if exists due_work_amount,
  drop column if exists laundry_rate_snapshot,
  drop column if exists hourly_rate_snapshot,
  drop column if exists raw_property_secondary,
  drop column if exists raw_property_primary,
  drop column if exists raw_person_name,
  drop column if exists source_payload,
  drop column if exists source_payload_hash,
  drop column if exists source_record_id,
  drop column if exists source_system,
  drop column if exists source_submitted_at,
  drop column if exists service_date_source,
  drop column if exists service_date,
  drop column if exists property_id,
  drop column if exists person_id;

alter table public.tibaldo_app_employee_profiles
  drop constraint if exists tibaldo_app_employee_profiles_status_check,
  drop column if exists status,
  alter column user_id set not null;

commit;
