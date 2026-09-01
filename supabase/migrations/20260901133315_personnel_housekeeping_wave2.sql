-- Personnel × Ménage Wave 2 — TEST/private beta only.
-- Owner decisions are applied additively; raw source payloads are immutable.

create table if not exists public.tibaldo_app_personnel_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'PROPERTY_MAPPING_OWNER_DECISION','PAYMENT_CREATED',
    'LEGACY_ADJUSTMENT_CLASSIFICATION','IMPORT_BATCH','IMPORT_CONFLICT'
  )),
  entity_type text not null,
  entity_id text,
  idempotency_key text,
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_type, idempotency_key)
);

create table if not exists public.tibaldo_app_property_mapping_decisions (
  id uuid primary key default gen_random_uuid(),
  housekeeping_entry_id uuid not null references public.housekeeping_entries(id) on delete restrict,
  previous_property_id uuid references public.airbnb_properties(id) on delete restrict,
  decided_property_id uuid references public.airbnb_properties(id) on delete restrict,
  previous_mapping_status text,
  decision text not null check (decision in ('FIVES','MELEZIO','GARE','WATTIGNIES','NO_PROPERTY_REQUIRED')),
  reason text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tibaldo_app_wave2_mapping_backup (
  entity_type text not null,
  entity_id text not null,
  state jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

alter table public.tibaldo_app_personnel_audit_events enable row level security;
alter table public.tibaldo_app_property_mapping_decisions enable row level security;
alter table public.tibaldo_app_wave2_mapping_backup enable row level security;
revoke all on public.tibaldo_app_personnel_audit_events from anon, authenticated;
revoke all on public.tibaldo_app_property_mapping_decisions from anon, authenticated;
revoke all on public.tibaldo_app_wave2_mapping_backup from anon, authenticated;
grant select on public.tibaldo_app_personnel_audit_events to authenticated;
grant select on public.tibaldo_app_property_mapping_decisions to authenticated;
grant select on public.tibaldo_app_wave2_mapping_backup to authenticated;
create policy tibaldo_app_personnel_audit_owner_read on public.tibaldo_app_personnel_audit_events
  for select to authenticated using ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_property_decisions_owner_read on public.tibaldo_app_property_mapping_decisions
  for select to authenticated using ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_wave2_backup_owner_read on public.tibaldo_app_wave2_mapping_backup
  for select to authenticated using ((select private.tibaldo_app_has_role('OWNER')));

-- Bounded pre-mutation backup: only fields Wave 2 is authorized to change.
insert into public.tibaldo_app_wave2_mapping_backup(entity_type, entity_id, state)
select 'HOUSEKEEPING_ENTRY', e.id::text,
  jsonb_build_object('property_id',e.property_id,'property',e.property,
    'mapping_status',e.mapping_status,'business_classification',e.business_classification)
from public.housekeeping_entries e
where e.source_system='google_forms_sheet'
  and (e.raw_property_primary in ('Gare','Lily','Tibado House')
    or e.raw_property_secondary in ('Gare','Lily','Tibado House'))
on conflict do nothing;

insert into public.tibaldo_app_wave2_mapping_backup(entity_type, entity_id, state)
select 'PAYMENT', p.id::text,
  jsonb_build_object('id',p.id,'payment_kind',p.payment_kind,
    'legacy_classification',p.legacy_classification)
from public.cleaner_payments p
where p.cleaner_name='Jennifer' and p.amount=-91.50
  and p.payment_date=date '2026-08-03' and p.note='Ajustement historique Jennifer'
on conflict do nothing;

insert into public.tibaldo_app_wave2_mapping_backup(entity_type, entity_id, state)
select 'PROPERTY_ALIAS', a.id::text, to_jsonb(a)
from public.tibaldo_app_property_aliases a where a.normalized_key in ('gare','lily','tibado-house')
on conflict do nothing;

-- Stable canonical Gare identity; no unproven metadata is added.
insert into public.airbnb_properties(name)
select 'Gare'
where not exists (select 1 from public.airbnb_properties where lower(name)='gare');

update public.tibaldo_app_property_aliases a
set canonical_property_id=p.id, canonical_business_label='Gare', status='RESOLVED',
    owner_review_required=false, updated_at=now()
from public.airbnb_properties p
where lower(p.name)='gare' and a.normalized_key in ('gare','lily');

-- Gare and Lily converge on the same property while retaining raw labels.
update public.housekeeping_entries e
set property_id=p.id, property='Gare', mapping_status='RESOLVED',
    business_classification=case
      when e.raw_property_primary='Lily' or e.raw_property_secondary='Lily'
        then 'LILY_ALIAS_TO_GARE_RESOLVED'
      else 'GARE_CANONICAL_PROPERTY_RESOLVED' end
from public.airbnb_properties p
where e.source_system='google_forms_sheet' and lower(p.name)='gare'
  and (e.raw_property_primary in ('Gare','Lily') or e.raw_property_secondary in ('Gare','Lily'));

-- Existing exact property mappings use the explicit Wave 2 state name.
update public.housekeeping_entries
set mapping_status='RESOLVED'
where source_system='google_forms_sheet' and property_id is not null and mapping_status='MAPPED';

-- Tibado House forensic result: one row explicitly names Fives in source text.
update public.housekeeping_entries e
set property_id=p.id, property='Fives', mapping_status='RESOLVED',
    business_classification='TIBADO_HOUSE_RESOLVED_FIVES_FROM_MISSION_DESCRIPTION'
from public.airbnb_properties p
where lower(p.name)='fives'
  and e.source_record_id='snapshot-2026-09-01-row-95-5f9bc9354a3959fd';

-- The remaining ten rows are generic Service client / internal-signage missions.
-- Their source does not identify a specific apartment and no property is required.
update public.housekeeping_entries e
set property_id=null, property=null, mapping_status='NO_PROPERTY_REQUIRED',
    business_classification='TIBADO_HOUSE_GENERIC_SERVICE_NO_PROPERTY_REQUIRED'
where e.source_system='google_forms_sheet'
  and (e.raw_property_primary='Tibado House' or e.raw_property_secondary='Tibado House')
  and e.source_record_id<>'snapshot-2026-09-01-row-95-5f9bc9354a3959fd';

update public.tibaldo_app_property_aliases
set canonical_property_id=null, canonical_business_label='Tibado House',
    status='OWNER_MAPPING_REQUIRED', owner_review_required=true, updated_at=now()
where normalized_key='tibado-house';

-- Restore the canonical production identity on the TEST clone and classify it.
update public.cleaner_payments
set id='f019ff2a-c0f5-4209-87c4-a1e3d10baee4',
    payment_kind='LEGACY_ADJUSTMENT',
    legacy_classification='LEGACY_BALANCE_CORRECTION_ORIGIN_NOT_PROVEN'
where cleaner_name='Jennifer' and amount=-91.50
  and payment_date=date '2026-08-03' and note='Ajustement historique Jennifer'
  and created_at='2026-08-03 11:25:52.961409+00'::timestamptz;

insert into public.tibaldo_app_personnel_audit_events(
  event_type,entity_type,entity_id,idempotency_key,details
) values (
  'LEGACY_ADJUSTMENT_CLASSIFICATION','cleaner_payment',
  'f019ff2a-c0f5-4209-87c4-a1e3d10baee4','wave2-jennifer-91-50',
  jsonb_build_object('classification','LEGACY_BALANCE_CORRECTION_ORIGIN_NOT_PROVEN',
    'technical_origin','844.28 due - 935.78 payments = -91.50',
    'business_origin','NOT_PROVEN')
) on conflict do nothing;

create or replace function private.tibaldo_app_resolve_property_mapping_private(
  target_entry_id uuid, owner_decision text, decision_reason text, request_key text
) returns public.housekeeping_entries language plpgsql security definer set search_path='' as $$
declare e public.housekeeping_entries; chosen_id uuid; normalized_decision text := upper(btrim(owner_decision));
begin
  if not private.tibaldo_app_has_role('OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if request_key is null or btrim(request_key)='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into e from public.housekeeping_entries where id=target_entry_id for update;
  if e.id is null then raise exception 'ENTRY_NOT_FOUND'; end if;
  if exists (select 1 from public.tibaldo_app_property_mapping_decisions where idempotency_key=request_key) then
    return e;
  end if;
  if normalized_decision not in ('FIVES','MELEZIO','GARE','WATTIGNIES','NO_PROPERTY_REQUIRED') then
    raise exception 'INVALID_PROPERTY_DECISION';
  end if;
  if normalized_decision<>'NO_PROPERTY_REQUIRED' then
    select id into chosen_id from public.airbnb_properties where upper(name)=normalized_decision limit 1;
    if chosen_id is null then raise exception 'CANONICAL_PROPERTY_NOT_FOUND'; end if;
  end if;
  insert into public.tibaldo_app_property_mapping_decisions(
    housekeeping_entry_id,previous_property_id,decided_property_id,previous_mapping_status,
    decision,reason,actor_user_id,idempotency_key
  ) values (e.id,e.property_id,chosen_id,e.mapping_status,normalized_decision,
    nullif(btrim(decision_reason),''),auth.uid(),request_key);
  update public.housekeeping_entries
  set property_id=chosen_id,
      property=case when chosen_id is null then null else initcap(lower(normalized_decision)) end,
      mapping_status=case when chosen_id is null then 'NO_PROPERTY_REQUIRED' else 'RESOLVED' end,
      business_classification='OWNER_PROPERTY_DECISION'
  where id=e.id returning * into e;
  insert into public.tibaldo_app_personnel_audit_events(
    event_type,entity_type,entity_id,idempotency_key,actor_user_id,details
  ) values ('PROPERTY_MAPPING_OWNER_DECISION','housekeeping_entry',e.id::text,request_key,
    auth.uid(),jsonb_build_object('decision',normalized_decision,'reason',decision_reason));
  return e;
end $$;

create or replace function public.tibaldo_app_resolve_property_mapping(
  target_entry_id uuid, owner_decision text, decision_reason text, request_key text
) returns public.housekeeping_entries language sql volatile security invoker set search_path='' as $$
  select private.tibaldo_app_resolve_property_mapping_private($1,$2,$3,$4)
$$;

create or replace function private.tibaldo_app_record_payment_private(
  target_person_id uuid, payment_amount numeric, paid_on date,
  payment_note text, kind text, reference text default null
) returns public.cleaner_payments language plpgsql security definer set search_path='' as $$
declare result public.cleaner_payments; person_name text; normalized_kind text := upper(btrim(kind));
begin
  if not private.tibaldo_app_has_role('OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if normalized_kind not in ('WAGE_PAYMENT','EXPENSE_REIMBURSEMENT','LEGACY_ADJUSTMENT','OTHER_REVIEWED') then
    raise exception 'INVALID_PAYMENT_KIND';
  end if;
  if payment_amount is null or payment_amount=0 then raise exception 'NON_ZERO_AMOUNT_REQUIRED'; end if;
  if normalized_kind<>'LEGACY_ADJUSTMENT' and payment_amount<0 then raise exception 'POSITIVE_AMOUNT_REQUIRED'; end if;
  select display_name into person_name from public.tibaldo_app_employee_profiles
    where id=target_person_id and active and status='ACTIVE';
  if person_name is null then raise exception 'ACTIVE_PERSON_REQUIRED'; end if;
  insert into public.cleaner_payments(
    cleaner_name,person_id,payment_date,amount,note,payment_kind,
    external_reference,created_by,legacy_classification,source_system
  ) values (person_name,target_person_id,coalesce(paid_on,current_date),payment_amount,
    nullif(btrim(payment_note),''),normalized_kind,nullif(btrim(reference),''),auth.uid(),
    case when normalized_kind='LEGACY_ADJUSTMENT' then 'OWNER_RECORDED_LEGACY_ADJUSTMENT'
      else 'CANONICAL_OWNER_RECORDED' end,'app_private_beta') returning * into result;
  insert into public.tibaldo_app_personnel_audit_events(
    event_type,entity_type,entity_id,idempotency_key,actor_user_id,details
  ) values ('PAYMENT_CREATED','cleaner_payment',result.id::text,result.id::text,auth.uid(),
    jsonb_build_object('person_id',target_person_id,'amount',payment_amount,
      'payment_date',paid_on,'payment_kind',normalized_kind));
  return result;
end $$;

create or replace function public.tibaldo_app_sync_housekeeping_row(
  source_identity text, payload_hash text, canonical_row jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.housekeeping_entries; resolved_person uuid; resolved_property uuid;
  next_status text; next_type text; new_id uuid; raw_primary text; raw_secondary text;
begin
  if not private.tibaldo_app_has_role('OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if coalesce(btrim(source_identity),'')='' or coalesce(btrim(payload_hash),'')='' then
    raise exception 'SOURCE_IDENTITY_AND_HASH_REQUIRED';
  end if;
  select * into existing from public.housekeeping_entries
    where source_system='google_forms_sheet' and source_record_id=source_identity for update;
  if existing.id is not null then
    if existing.source_payload_hash=payload_hash then
      return jsonb_build_object('status','NO_DUPLICATE','entry_id',existing.id);
    end if;
    insert into public.tibaldo_app_personnel_audit_events(
      event_type,entity_type,entity_id,idempotency_key,actor_user_id,details
    ) values ('IMPORT_CONFLICT','housekeeping_entry',existing.id::text,
      source_identity||':'||payload_hash,auth.uid(),
      jsonb_build_object('source_record_id',source_identity,'stored_hash',existing.source_payload_hash,
        'incoming_hash',payload_hash)) on conflict do nothing;
    return jsonb_build_object('status','REVIEW_REQUIRED','entry_id',existing.id);
  end if;
  raw_primary=nullif(canonical_row->>'raw_property_primary','');
  raw_secondary=nullif(canonical_row->>'raw_property_secondary','');
  next_type=coalesce(nullif(canonical_row->>'service_type',''),'MISC_SERVICE');
  select a.person_id into resolved_person from public.tibaldo_app_person_aliases a
    where lower(a.raw_label)=lower(canonical_row->>'raw_person_name') limit 1;
  if resolved_person is null then raise exception 'PERSON_ALIAS_REVIEW_REQUIRED'; end if;
  select a.canonical_property_id into resolved_property from public.tibaldo_app_property_aliases a
    where a.status='RESOLVED' and a.normalized_key in (lower(raw_primary),lower(raw_secondary))
      and a.canonical_property_id is not null limit 1;
  next_status=case when resolved_property is not null then 'RESOLVED'
    when raw_primary is null and raw_secondary is null and next_type in ('LAUNDRY','PURCHASE','MISC_SERVICE')
      then 'NO_PROPERTY_REQUIRED' else 'PROPERTY_REVIEW_REQUIRED' end;
  insert into public.housekeeping_entries(
    staff_name,person_id,service_type,minutes,property,property_id,service_date,
    service_date_source,source_submitted_at,source_system,source_record_id,
    source_payload_hash,source_payload,raw_person_name,raw_property_primary,
    raw_property_secondary,hourly_rate_snapshot,laundry_rate_snapshot,
    linen_pairs,due_work_amount,due_laundry_amount,due_purchase_amount,due_total_amount,
    mapping_status,business_classification,status,duplicate_key
  ) values (
    canonical_row->>'raw_person_name',resolved_person,next_type,
    coalesce((canonical_row->>'minutes')::integer,0),
    (select name from public.airbnb_properties where id=resolved_property),resolved_property,
    (canonical_row->>'service_date')::date,'SOURCE_PAYLOAD',
    (canonical_row->>'source_submitted_at')::timestamptz,'google_forms_sheet',source_identity,
    payload_hash,canonical_row->'source_payload',canonical_row->>'raw_person_name',raw_primary,raw_secondary,
    15,3,coalesce((canonical_row->>'linen_pairs')::integer,0),
    round(coalesce((canonical_row->>'minutes')::numeric,0)*0.25,2),
    round(coalesce((canonical_row->>'linen_pairs')::numeric,0)*3,2),
    round(coalesce((canonical_row->>'purchase_amount')::numeric,0),2),
    round(coalesce((canonical_row->>'minutes')::numeric,0)*0.25
      +coalesce((canonical_row->>'linen_pairs')::numeric,0)*3
      +coalesce((canonical_row->>'purchase_amount')::numeric,0),2),
    next_status,'INCREMENTAL_PHASE_A', 'validated',source_identity
  ) returning id into new_id;
  insert into public.tibaldo_app_personnel_audit_events(
    event_type,entity_type,entity_id,idempotency_key,actor_user_id,details
  ) values ('IMPORT_BATCH','housekeeping_entry',new_id::text,source_identity,auth.uid(),
    jsonb_build_object('source_record_id',source_identity,'source_payload_hash',payload_hash));
  return jsonb_build_object('status','IMPORTED','entry_id',new_id);
end $$;

revoke all on function private.tibaldo_app_resolve_property_mapping_private(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.tibaldo_app_resolve_property_mapping(uuid,text,text,text) from public,anon;
revoke all on function public.tibaldo_app_sync_housekeeping_row(text,text,jsonb) from public,anon;
grant execute on function private.tibaldo_app_resolve_property_mapping_private(uuid,text,text,text) to authenticated;
grant execute on function public.tibaldo_app_resolve_property_mapping(uuid,text,text,text) to authenticated;
grant execute on function public.tibaldo_app_sync_housekeeping_row(text,text,jsonb) to authenticated;

comment on function public.tibaldo_app_resolve_property_mapping(uuid,text,text,text) is
  'Owner-only, audited and idempotent property decision. Raw source payload is never changed.';
comment on function public.tibaldo_app_sync_housekeeping_row(text,text,jsonb) is
  'Owner-only bounded Phase A sync. Same hash is idempotent; changed payload fails closed to review.';
