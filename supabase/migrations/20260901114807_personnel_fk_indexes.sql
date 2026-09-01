create index if not exists tibaldo_app_person_aliases_person_id_idx
  on public.tibaldo_app_person_aliases(person_id);
create index if not exists tibaldo_app_property_aliases_property_id_idx
  on public.tibaldo_app_property_aliases(canonical_property_id);
create index if not exists tibaldo_app_import_batches_created_by_idx
  on public.tibaldo_app_housekeeping_import_batches(created_by);
create index if not exists cleaner_payments_created_by_idx
  on public.cleaner_payments(created_by);
