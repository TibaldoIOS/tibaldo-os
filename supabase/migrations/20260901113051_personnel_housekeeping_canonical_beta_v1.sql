-- Wave 1 private-beta canonicalization. Additive over App V2; never apply to
-- production without reconciling the live 2026-08-31 security hardening.

create schema if not exists private;

-- TEST did not yet contain this production source-of-truth table. This exact
-- additive definition is a no-op where the production table already exists.
create table if not exists public.airbnb_properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  credit numeric not null default 0,
  loan_insurance numeric not null default 0,
  electricity numeric not null default 0,
  gas numeric not null default 0,
  internet numeric not null default 0,
  pno_insurance numeric not null default 0,
  copro_charges numeric not null default 0,
  cleaning numeric not null default 0,
  keyboxes numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.tibaldo_app_employee_profiles
  alter column user_id drop not null,
  add column if not exists status text not null default 'ACTIVE',
  add constraint tibaldo_app_employee_profiles_status_check
    check (status in ('ACTIVE', 'INACTIVE', 'REVIEW')) not valid;

alter table public.tibaldo_app_employee_profiles
  validate constraint tibaldo_app_employee_profiles_status_check;

comment on column public.tibaldo_app_employee_profiles.id is
  'Canonical stable person_id. display_name/staff_key are labels, never business PKs.';

create table if not exists public.tibaldo_app_person_aliases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.tibaldo_app_employee_profiles(id) on delete cascade,
  source_system text not null default 'google_forms_sheet',
  raw_label text not null,
  normalized_key text not null,
  created_at timestamptz not null default now(),
  unique (source_system, normalized_key)
);

create table if not exists public.tibaldo_app_property_aliases (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'google_forms_sheet',
  raw_source_label text not null,
  normalized_key text not null,
  canonical_property_id uuid references public.airbnb_properties(id) on delete restrict,
  canonical_business_label text,
  status text not null check (status in ('RESOLVED', 'BUSINESS_ALIAS_ONLY', 'OWNER_MAPPING_REQUIRED')),
  owner_review_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, normalized_key)
);

alter table public.housekeeping_entries
  add column if not exists person_id uuid references public.tibaldo_app_employee_profiles(id) on delete restrict,
  add column if not exists property_id uuid references public.airbnb_properties(id) on delete restrict,
  add column if not exists service_date date,
  add column if not exists service_date_source text,
  add column if not exists source_submitted_at timestamptz,
  add column if not exists source_system text,
  add column if not exists source_record_id text,
  add column if not exists source_payload_hash text,
  add column if not exists source_payload jsonb,
  add column if not exists raw_person_name text,
  add column if not exists raw_property_primary text,
  add column if not exists raw_property_secondary text,
  add column if not exists hourly_rate_snapshot numeric(12,2),
  add column if not exists laundry_rate_snapshot numeric(12,2),
  add column if not exists due_work_amount numeric(12,2),
  add column if not exists due_laundry_amount numeric(12,2),
  add column if not exists due_purchase_amount numeric(12,2),
  add column if not exists due_total_amount numeric(12,2),
  add column if not exists mapping_status text,
  add column if not exists business_classification text,
  add column if not exists import_batch_id uuid;

create unique index if not exists housekeeping_entries_source_identity_uidx
  on public.housekeeping_entries(source_system, source_record_id)
  where source_system is not null and source_record_id is not null;
create index if not exists housekeeping_entries_person_service_date_idx
  on public.housekeeping_entries(person_id, service_date desc);
create index if not exists housekeeping_entries_property_service_date_idx
  on public.housekeeping_entries(property_id, service_date desc);

alter table public.cleaner_payments
  add column if not exists person_id uuid references public.tibaldo_app_employee_profiles(id) on delete restrict,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists payment_kind text,
  add column if not exists external_reference text,
  add column if not exists legacy_classification text,
  add column if not exists source_system text,
  add column if not exists source_record_id text,
  add column if not exists import_batch_id uuid;

create unique index if not exists cleaner_payments_source_identity_uidx
  on public.cleaner_payments(source_system, source_record_id)
  where source_system is not null and source_record_id is not null;
create index if not exists cleaner_payments_person_date_idx
  on public.cleaner_payments(person_id, payment_date desc);

create table if not exists public.tibaldo_app_housekeeping_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_snapshot text not null,
  source_row_count integer not null check (source_row_count >= 0),
  imported_row_count integer not null default 0 check (imported_row_count >= 0),
  source_checksum text not null,
  status text not null check (status in ('STARTED', 'VERIFIED', 'FAILED', 'ROLLED_BACK')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (source_system, source_snapshot, source_checksum)
);

create index if not exists tibaldo_app_person_aliases_person_id_idx
  on public.tibaldo_app_person_aliases(person_id);
create index if not exists tibaldo_app_property_aliases_property_id_idx
  on public.tibaldo_app_property_aliases(canonical_property_id);
create index if not exists tibaldo_app_import_batches_created_by_idx
  on public.tibaldo_app_housekeeping_import_batches(created_by);
create index if not exists cleaner_payments_created_by_idx
  on public.cleaner_payments(created_by);

-- Canonical people. Existing synthetic beta profiles are retained separately.
insert into public.tibaldo_app_employee_profiles(user_id, display_name, staff_key, active, status)
values
  (null, 'Gaelle', 'gaelle', true, 'ACTIVE'),
  (null, 'Jennifer', 'jennifer', true, 'ACTIVE'),
  (null, 'Rachida', 'rachida', true, 'ACTIVE')
on conflict (staff_key) do update
set display_name = excluded.display_name, active = true, status = 'ACTIVE', updated_at = now();

insert into public.tibaldo_app_person_aliases(person_id, raw_label, normalized_key)
select p.id, v.raw_label, v.normalized_key
from (values
  ('gaelle', 'Gaelle', 'gaelle'),
  ('gaelle', 'Gaëlle', 'gaelle-accent'),
  ('jennifer', 'Jennifer', 'jennifer'),
  ('rachida', 'Rachida', 'rachida')
) as v(staff_key, raw_label, normalized_key)
join public.tibaldo_app_employee_profiles p on p.staff_key = v.staff_key
on conflict (source_system, normalized_key) do update
set person_id = excluded.person_id, raw_label = excluded.raw_label;

insert into public.tibaldo_app_property_aliases(
  raw_source_label, normalized_key, canonical_property_id,
  canonical_business_label, status, owner_review_required
)
select v.raw_label, v.normalized_key, p.id, v.business_label, v.status, v.review
from (values
  ('Fives', 'fives', 'Fives', 'RESOLVED', false),
  ('Melezio', 'melezio', 'Melezio', 'RESOLVED', false),
  ('Gare', 'gare', 'Gare', 'OWNER_MAPPING_REQUIRED', true),
  ('Lily', 'lily', 'Gare', 'BUSINESS_ALIAS_ONLY', true),
  ('Tibado House', 'tibado-house', 'Tibado House', 'OWNER_MAPPING_REQUIRED', true)
) as v(raw_label, normalized_key, business_label, status, review)
left join public.airbnb_properties p
  on v.status = 'RESOLVED' and lower(p.name) = lower(v.business_label)
on conflict (source_system, normalized_key) do update
set canonical_property_id = excluded.canonical_property_id,
    canonical_business_label = excluded.canonical_business_label,
    status = excluded.status,
    owner_review_required = excluded.owner_review_required,
    updated_at = now();

create or replace function private.tibaldo_app_current_person_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.tibaldo_app_employee_profiles p
  join public.tibaldo_app_memberships m on m.user_id = p.user_id
  where p.user_id = (select auth.uid()) and p.active and p.status = 'ACTIVE'
    and m.role = 'EMPLOYEE'
  limit 1
$$;

create or replace function private.tibaldo_app_can_read_person(target_person_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.tibaldo_app_has_role('OWNER'))
    or ((select private.tibaldo_app_has_role('EMPLOYEE'))
        and target_person_id = (select private.tibaldo_app_current_person_id()))
$$;

create or replace function private.tibaldo_app_personnel_balances_private()
returns table (
  person_id uuid, display_name text, total_minutes bigint, total_hours numeric,
  linen_pairs bigint, due_work numeric, due_laundry numeric, due_other numeric,
  total_due numeric, wage_payments_included numeric,
  excluded_reimbursements numeric, legacy_adjustments numeric, balance numeric
) language sql stable security definer set search_path = '' as $$
  with due as (
    select e.person_id,
      coalesce(sum(e.minutes),0)::bigint total_minutes,
      coalesce(sum(e.linen_pairs),0)::bigint linen_pairs,
      coalesce(sum(e.due_work_amount),0)::numeric due_work,
      coalesce(sum(e.due_laundry_amount),0)::numeric due_laundry,
      coalesce(sum(e.due_purchase_amount),0)::numeric due_other,
      coalesce(sum(e.due_total_amount),0)::numeric total_due
    from public.housekeeping_entries e where e.person_id is not null group by e.person_id
  ), paid as (
    select p.person_id,
      coalesce(sum(p.amount) filter (where coalesce(p.legacy_classification,'') <> 'EXPENSE_REIMBURSEMENT_EXCLUDED_FROM_WAGE_BALANCE'),0)::numeric wage_paid,
      coalesce(sum(p.amount) filter (where p.legacy_classification = 'EXPENSE_REIMBURSEMENT_EXCLUDED_FROM_WAGE_BALANCE'),0)::numeric excluded,
      coalesce(sum(p.amount) filter (where p.legacy_classification = 'LEGACY_ADJUSTMENT_OWNER_REVIEW'),0)::numeric adjustments
    from public.cleaner_payments p where p.person_id is not null group by p.person_id
  )
  select pr.id, pr.display_name, coalesce(d.total_minutes,0),
    round(coalesce(d.total_minutes,0)::numeric / 60, 4), coalesce(d.linen_pairs,0),
    round(coalesce(d.due_work,0),2), round(coalesce(d.due_laundry,0),2),
    round(coalesce(d.due_other,0),2), round(coalesce(d.total_due,0),2),
    round(coalesce(pa.wage_paid,0),2), round(coalesce(pa.excluded,0),2),
    round(coalesce(pa.adjustments,0),2),
    round(coalesce(d.total_due,0) - coalesce(pa.wage_paid,0),2)
  from public.tibaldo_app_employee_profiles pr
  left join due d on d.person_id = pr.id left join paid pa on pa.person_id = pr.id
  where pr.staff_key in ('gaelle','jennifer','rachida')
    and private.tibaldo_app_can_read_person(pr.id)
  order by pr.display_name
$$;

create or replace function public.tibaldo_app_personnel_balances()
returns table (
  person_id uuid, display_name text, total_minutes bigint, total_hours numeric,
  linen_pairs bigint, due_work numeric, due_laundry numeric, due_other numeric,
  total_due numeric, wage_payments_included numeric,
  excluded_reimbursements numeric, legacy_adjustments numeric, balance numeric
) language sql stable security invoker set search_path = '' as $$
  select * from private.tibaldo_app_personnel_balances_private()
$$;

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

create or replace function private.tibaldo_app_record_payment_private(
  target_person_id uuid, payment_amount numeric, paid_on date,
  payment_note text, kind text, reference text default null
) returns public.cleaner_payments language plpgsql security definer set search_path = '' as $$
declare result public.cleaner_payments; person_name text;
begin
  if not private.tibaldo_app_has_role('OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if payment_amount is null or payment_amount <= 0 then raise exception 'POSITIVE_AMOUNT_REQUIRED'; end if;
  select display_name into person_name from public.tibaldo_app_employee_profiles
    where id = target_person_id and active and status = 'ACTIVE';
  if person_name is null then raise exception 'ACTIVE_PERSON_REQUIRED'; end if;
  insert into public.cleaner_payments(
    cleaner_name, person_id, payment_date, amount, note, payment_kind,
    external_reference, created_by, legacy_classification, source_system
  ) values (
    person_name, target_person_id, coalesce(paid_on,current_date), payment_amount,
    nullif(btrim(payment_note),''), coalesce(nullif(btrim(kind),''),'WAGE_PAYMENT'),
    nullif(btrim(reference),''), auth.uid(), 'CANONICAL_OWNER_RECORDED', 'app_private_beta'
  ) returning * into result;
  return result;
end $$;

create or replace function public.tibaldo_app_record_payment(
  target_person_id uuid, payment_amount numeric, paid_on date,
  payment_note text, kind text, reference text default null
) returns public.cleaner_payments language sql volatile security invoker set search_path = '' as $$
  select private.tibaldo_app_record_payment_private(target_person_id,payment_amount,paid_on,payment_note,kind,reference)
$$;

alter table public.tibaldo_app_person_aliases enable row level security;
alter table public.tibaldo_app_property_aliases enable row level security;
alter table public.tibaldo_app_housekeeping_import_batches enable row level security;

revoke all on table public.tibaldo_app_person_aliases from anon, authenticated;
revoke all on table public.tibaldo_app_property_aliases from anon, authenticated;
revoke all on table public.tibaldo_app_housekeeping_import_batches from anon, authenticated;
grant select on table public.tibaldo_app_person_aliases to authenticated;
grant select on table public.tibaldo_app_property_aliases to authenticated;
grant select on table public.tibaldo_app_housekeeping_import_batches to authenticated;

create policy tibaldo_app_person_aliases_owner_select on public.tibaldo_app_person_aliases
  for select to authenticated using ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_property_aliases_owner_select on public.tibaldo_app_property_aliases
  for select to authenticated using ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_import_batches_owner_select on public.tibaldo_app_housekeeping_import_batches
  for select to authenticated using ((select private.tibaldo_app_has_role('OWNER')));

-- Canonical direct ledgers remain Owner-only; Employee access is RPC-only.
drop policy if exists tibaldo_app_cleaner_payments_owner_delete on public.cleaner_payments;
revoke update, delete on table public.cleaner_payments from authenticated;

revoke all on function private.tibaldo_app_current_person_id() from public, anon;
revoke all on function private.tibaldo_app_can_read_person(uuid) from public, anon;
revoke all on function private.tibaldo_app_personnel_balances_private() from public, anon;
revoke all on function private.tibaldo_app_person_entries_private(uuid) from public, anon;
revoke all on function private.tibaldo_app_person_payments_private(uuid) from public, anon;
revoke all on function private.tibaldo_app_record_payment_private(uuid,numeric,date,text,text,text) from public, anon, authenticated;
revoke all on function public.tibaldo_app_personnel_balances() from public, anon;
revoke all on function public.tibaldo_app_person_entries(uuid) from public, anon;
revoke all on function public.tibaldo_app_person_payments(uuid) from public, anon;
revoke all on function public.tibaldo_app_record_payment(uuid,numeric,date,text,text,text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.tibaldo_app_current_person_id() to authenticated;
grant execute on function private.tibaldo_app_can_read_person(uuid) to authenticated;
grant execute on function private.tibaldo_app_personnel_balances_private() to authenticated;
grant execute on function private.tibaldo_app_person_entries_private(uuid) to authenticated;
grant execute on function private.tibaldo_app_person_payments_private(uuid) to authenticated;
grant execute on function private.tibaldo_app_record_payment_private(uuid,numeric,date,text,text,text) to authenticated;
grant execute on function public.tibaldo_app_personnel_balances() to authenticated;
grant execute on function public.tibaldo_app_person_entries(uuid) to authenticated;
grant execute on function public.tibaldo_app_person_payments(uuid) to authenticated;
grant execute on function public.tibaldo_app_record_payment(uuid,numeric,date,text,text,text) to authenticated;

comment on function public.tibaldo_app_personnel_balances() is
  'Server-derived canonical due/payment/balance projection; never stores current balance.';
comment on function public.tibaldo_app_record_payment(uuid,numeric,date,text,text,text) is
  'Owner-only append action recording an already completed payment; executes no bank payment.';
