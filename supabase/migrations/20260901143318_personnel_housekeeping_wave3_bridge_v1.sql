create or replace function private.tibaldo_app_sync_housekeeping_row(
  source_identity text, payload_hash text, canonical_row jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  existing public.housekeeping_entries;
  resolved_person uuid;
  resolved_property uuid;
  next_status text;
  next_type text;
  next_classification text := 'INCREMENTAL_PHASE_A';
  new_id uuid;
  raw_primary text;
  raw_secondary text;
  mission text;
begin
  if not private.tibaldo_app_has_role('OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if coalesce(btrim(source_identity),'')='' or coalesce(btrim(payload_hash),'')='' then
    raise exception 'SOURCE_IDENTITY_AND_HASH_REQUIRED';
  end if;

  select * into existing
  from public.housekeeping_entries
  where source_system='google_forms_sheet' and source_record_id=source_identity
  for update;

  if existing.id is not null then
    if existing.source_payload_hash=payload_hash then
      return jsonb_build_object('status','NO_DUPLICATE','entry_id',existing.id);
    end if;
    insert into public.tibaldo_app_personnel_audit_events(
      event_type,entity_type,entity_id,idempotency_key,actor_user_id,details
    ) values (
      'IMPORT_CONFLICT','housekeeping_entry',existing.id::text,
      source_identity||':'||payload_hash,auth.uid(),
      jsonb_build_object(
        'source_record_id',source_identity,
        'stored_hash',existing.source_payload_hash,
        'incoming_hash',payload_hash
      )
    ) on conflict do nothing;
    return jsonb_build_object('status','REVIEW_REQUIRED','entry_id',existing.id);
  end if;

  raw_primary=nullif(canonical_row->>'raw_property_primary','');
  raw_secondary=nullif(canonical_row->>'raw_property_secondary','');
  mission=nullif(canonical_row->>'mission_description','');
  next_type=coalesce(nullif(canonical_row->>'service_type',''),'MISC_SERVICE');

  select a.person_id into resolved_person
  from public.tibaldo_app_person_aliases a
  where lower(a.raw_label)=lower(canonical_row->>'raw_person_name')
  limit 1;
  if resolved_person is null then raise exception 'PERSON_ALIAS_REVIEW_REQUIRED'; end if;

  select a.canonical_property_id into resolved_property
  from public.tibaldo_app_property_aliases a
  where a.status='RESOLVED'
    and a.normalized_key in (lower(raw_primary),lower(raw_secondary))
    and a.canonical_property_id is not null
  limit 1;

  if lower(raw_secondary)='tibado house' and next_type='MISC_SERVICE'
      and lower(coalesce(mission,'')) not like '%fives%' then
    resolved_property=null;
    next_status='NO_PROPERTY_REQUIRED';
    next_classification='TIBADO_HOUSE_GENERIC_SERVICE_NO_PROPERTY_REQUIRED';
  elsif resolved_property is not null then
    next_status='RESOLVED';
  elsif raw_primary is null and raw_secondary is null
      and next_type in ('LAUNDRY','PURCHASE','MISC_SERVICE') then
    next_status='NO_PROPERTY_REQUIRED';
  else
    next_status='PROPERTY_REVIEW_REQUIRED';
  end if;

  insert into public.housekeeping_entries(
    staff_name,person_id,service_type,minutes,purchase_done,purchased_products,
    purchase_amount,ticket_paths,property,property_id,surfaces,rooms,remarks,
    linen_pairs,photo_paths,mission_description,service_date,service_date_source,
    source_submitted_at,source_row,source_system,source_record_id,
    source_payload_hash,source_payload,raw_person_name,raw_property_primary,
    raw_property_secondary,hourly_rate_snapshot,laundry_rate_snapshot,
    due_work_amount,due_laundry_amount,due_purchase_amount,due_total_amount,
    mapping_status,business_classification,status,duplicate_key
  ) values (
    canonical_row->>'raw_person_name',resolved_person,next_type,
    coalesce((canonical_row->>'minutes')::integer,0),
    coalesce((canonical_row->>'purchase_done')::boolean,false),
    array(select jsonb_array_elements_text(coalesce(canonical_row->'purchased_products','[]'::jsonb))),
    round(coalesce((canonical_row->>'purchase_amount')::numeric,0),2),
    array(select jsonb_array_elements_text(coalesce(canonical_row->'ticket_paths','[]'::jsonb))),
    (select name from public.airbnb_properties where id=resolved_property),resolved_property,
    array(select jsonb_array_elements_text(coalesce(canonical_row->'surfaces','[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(canonical_row->'rooms','[]'::jsonb))),
    nullif(canonical_row->>'remarks',''),
    coalesce((canonical_row->>'linen_pairs')::integer,0),
    array(select jsonb_array_elements_text(coalesce(canonical_row->'photo_paths','[]'::jsonb))),
    mission,(canonical_row->>'service_date')::date,'SOURCE_PAYLOAD',
    (canonical_row->>'source_submitted_at')::timestamptz,
    nullif(canonical_row->>'source_row',''),'google_forms_sheet',source_identity,
    payload_hash,canonical_row->'source_payload',canonical_row->>'raw_person_name',raw_primary,raw_secondary,
    15,3,
    round(coalesce((canonical_row->>'minutes')::numeric,0)*0.25,2),
    round(coalesce((canonical_row->>'linen_pairs')::numeric,0)*3,2),
    round(coalesce((canonical_row->>'purchase_amount')::numeric,0),2),
    round(
      coalesce((canonical_row->>'minutes')::numeric,0)*0.25
      +coalesce((canonical_row->>'linen_pairs')::numeric,0)*3
      +coalesce((canonical_row->>'purchase_amount')::numeric,0),2
    ),
    next_status,next_classification,'validated',source_identity
  ) returning id into new_id;

  insert into public.tibaldo_app_personnel_audit_events(
    event_type,entity_type,entity_id,idempotency_key,actor_user_id,details
  ) values (
    'IMPORT_BATCH','housekeeping_entry',new_id::text,source_identity,auth.uid(),
    jsonb_build_object('source_record_id',source_identity,'source_payload_hash',payload_hash)
  );
  return jsonb_build_object('status','IMPORTED','entry_id',new_id);
end $$;

revoke all on function private.tibaldo_app_sync_housekeeping_row(text,text,jsonb)
  from public,anon;
grant execute on function private.tibaldo_app_sync_housekeeping_row(text,text,jsonb)
  to authenticated;

-- The two Wave 3 rows were imported before the bridge copied all operational
-- fields. Rehydrate only those fields from their immutable source payload.
update public.housekeeping_entries
set
  source_row='google_forms_sheet:2026-09-01:row:208',
  purchase_done=false,
  purchased_products='{}'::text[],
  ticket_paths='{}'::text[],
  surfaces='{}'::text[],
  rooms='{}'::text[],
  photo_paths='{}'::text[],
  business_classification='LAUNDRY_ONLY_NO_PROPERTY_REQUIRED'
where source_system='google_forms_sheet'
  and source_record_id='snapshot-2026-09-01-row-208-a6c18d8dfe27632b'
  and source_payload_hash='a6c18d8dfe27632bbffa2d6e8411d8085049728957635b50321b4a82b14dfc64';

update public.housekeeping_entries
set
  source_row='google_forms_sheet:2026-09-01:row:209',
  purchase_done=false,
  purchased_products='{}'::text[],
  ticket_paths='{}'::text[],
  surfaces='{}'::text[],
  rooms='{}'::text[],
  photo_paths='{}'::text[],
  mission_description='Du 24 au 30/08',
  property=null,
  property_id=null,
  mapping_status='NO_PROPERTY_REQUIRED',
  business_classification='TIBADO_HOUSE_GENERIC_SERVICE_NO_PROPERTY_REQUIRED'
where source_system='google_forms_sheet'
  and source_record_id='snapshot-2026-09-01-row-209-dd347b5f90fa405e'
  and source_payload_hash='dd347b5f90fa405e5e9ffafd350d103cf42f28bf680eaf635df53afd933854d8';

comment on function private.tibaldo_app_sync_housekeeping_row(text,text,jsonb) is
  'Owner-only Wave 3 canonical bridge. Same identity/hash is idempotent; changed hash fails closed; operational source fields are preserved.';
