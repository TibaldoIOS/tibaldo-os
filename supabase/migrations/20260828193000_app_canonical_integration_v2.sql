create schema if not exists private;

create table if not exists public.tibaldo_app_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER', 'EMPLOYEE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tibaldo_app_opening_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  seed_key text,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text,
  due_date date not null,
  week_label text not null,
  category text not null check (category in (
    'BOUTIQUE', 'INFORMATIQUE', 'PLANTES', 'STOCK', 'CHATS',
    'ADMINISTRATIF', 'COMMUNICATION', 'FOURNISSEURS', 'OUVERTURE', 'PERSONNEL'
  )),
  priority text not null default 'P1_IMPORTANT'
    check (priority in ('P0_CRITICAL', 'P1_IMPORTANT', 'P2_CAN_WAIT')),
  status text not null default 'TODO'
    check (status in ('TODO', 'IN_PROGRESS', 'DONE', 'DEFERRED')),
  effort text not null default 'NORMAL'
    check (effort in ('LIGHT', 'NORMAL', 'HEAVY')),
  notes text,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, seed_key)
);

create index if not exists tibaldo_app_opening_tasks_owner_due_idx
  on public.tibaldo_app_opening_tasks (owner_user_id, due_date, sort_order);

create table if not exists public.tibaldo_app_employee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  staff_key text not null unique check (staff_key ~ '^[a-z0-9_-]{2,40}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.tibaldo_app_has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tibaldo_app_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.role = required_role
  );
$$;

create or replace function private.tibaldo_app_staff_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(btrim(coalesce(value, ''))), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc'),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

-- Upgrade V1 safely: CREATE TABLE IF NOT EXISTS does not add later columns.
alter table public.tibaldo_app_employee_profiles
  add column if not exists staff_key text;

update public.tibaldo_app_employee_profiles
set staff_key = private.tibaldo_app_staff_key(display_name)
where staff_key is null;

do $$
begin
  if exists (
    select 1
    from public.tibaldo_app_employee_profiles
    group by staff_key
    having count(*) > 1
  ) then
    raise exception 'EMPLOYEE_STAFF_KEY_COLLISION_REQUIRES_REVIEW';
  end if;
end;
$$;

alter table public.tibaldo_app_employee_profiles
  alter column staff_key set not null;
create unique index if not exists tibaldo_app_employee_profiles_staff_key_uidx
  on public.tibaldo_app_employee_profiles(staff_key);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tibaldo_app_employee_profiles'::regclass
      and conname = 'tibaldo_app_employee_profiles_staff_key_check'
  ) then
    alter table public.tibaldo_app_employee_profiles
      add constraint tibaldo_app_employee_profiles_staff_key_check
      check (staff_key ~ '^[a-z0-9_-]{2,40}$');
  end if;
end;
$$;

-- Preserve the existing app.tibaldo.fr identity as the sole Owner identity.
insert into public.tibaldo_app_memberships(user_id, role)
select id, 'OWNER'
from auth.users
where lower(email) = lower('contact@tibaldo.fr')
on conflict (user_id) do update set role = excluded.role, updated_at = now();

-- Retire the isolated V1 duplicate employee ledgers when upgrading that schema.
drop function if exists public.tibaldo_app_submit_intervention_duration(uuid, integer);
drop table if exists public.tibaldo_app_employee_payments;
drop table if exists public.tibaldo_app_employee_interventions;

create or replace function private.tibaldo_app_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tibaldo_app_memberships_touch_updated_at on public.tibaldo_app_memberships;
create trigger tibaldo_app_memberships_touch_updated_at
before update on public.tibaldo_app_memberships
for each row execute function private.tibaldo_app_touch_updated_at();

drop trigger if exists tibaldo_app_opening_tasks_touch_updated_at on public.tibaldo_app_opening_tasks;
create trigger tibaldo_app_opening_tasks_touch_updated_at
before update on public.tibaldo_app_opening_tasks
for each row execute function private.tibaldo_app_touch_updated_at();

drop trigger if exists tibaldo_app_employee_profiles_touch_updated_at on public.tibaldo_app_employee_profiles;
create trigger tibaldo_app_employee_profiles_touch_updated_at
before update on public.tibaldo_app_employee_profiles
for each row execute function private.tibaldo_app_touch_updated_at();

alter table public.tibaldo_app_memberships enable row level security;
alter table public.tibaldo_app_opening_tasks enable row level security;
alter table public.tibaldo_app_employee_profiles enable row level security;
alter table public.cleaner_payments enable row level security;
alter table public.housekeeping_entries enable row level security;

revoke all on function private.tibaldo_app_has_role(text) from public, anon;
revoke all on function private.tibaldo_app_staff_key(text) from public, anon;
grant execute on function private.tibaldo_app_has_role(text) to authenticated;
grant execute on function private.tibaldo_app_staff_key(text) to authenticated;

revoke all on table public.tibaldo_app_memberships from anon, authenticated;
revoke all on table public.tibaldo_app_opening_tasks from anon, authenticated;
revoke all on table public.tibaldo_app_employee_profiles from anon, authenticated;
grant select on table public.tibaldo_app_memberships to authenticated;
grant select, insert, update, delete on table public.tibaldo_app_opening_tasks to authenticated;
grant select, insert, update, delete on table public.tibaldo_app_employee_profiles to authenticated;

drop policy if exists tibaldo_app_memberships_select_self_or_owner on public.tibaldo_app_memberships;
create policy tibaldo_app_memberships_select_self_or_owner
  on public.tibaldo_app_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.tibaldo_app_has_role('OWNER')));

drop policy if exists tibaldo_app_opening_tasks_owner_select on public.tibaldo_app_opening_tasks;
drop policy if exists tibaldo_app_opening_tasks_owner_insert on public.tibaldo_app_opening_tasks;
drop policy if exists tibaldo_app_opening_tasks_owner_update on public.tibaldo_app_opening_tasks;
drop policy if exists tibaldo_app_opening_tasks_owner_delete on public.tibaldo_app_opening_tasks;
create policy tibaldo_app_opening_tasks_owner_select
  on public.tibaldo_app_opening_tasks for select to authenticated
  using (owner_user_id = (select auth.uid()) and (select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_opening_tasks_owner_insert
  on public.tibaldo_app_opening_tasks for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and (select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_opening_tasks_owner_update
  on public.tibaldo_app_opening_tasks for update to authenticated
  using (owner_user_id = (select auth.uid()) and (select private.tibaldo_app_has_role('OWNER')))
  with check (owner_user_id = (select auth.uid()) and (select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_opening_tasks_owner_delete
  on public.tibaldo_app_opening_tasks for delete to authenticated
  using (owner_user_id = (select auth.uid()) and (select private.tibaldo_app_has_role('OWNER')));

drop policy if exists tibaldo_app_employee_profiles_select_self_or_owner on public.tibaldo_app_employee_profiles;
drop policy if exists tibaldo_app_employee_profiles_owner_insert on public.tibaldo_app_employee_profiles;
drop policy if exists tibaldo_app_employee_profiles_owner_update on public.tibaldo_app_employee_profiles;
drop policy if exists tibaldo_app_employee_profiles_owner_delete on public.tibaldo_app_employee_profiles;
create policy tibaldo_app_employee_profiles_select_self_or_owner
  on public.tibaldo_app_employee_profiles for select to authenticated
  using (
    (user_id = (select auth.uid()) and active)
    or (select private.tibaldo_app_has_role('OWNER'))
  );
create policy tibaldo_app_employee_profiles_owner_insert
  on public.tibaldo_app_employee_profiles for insert to authenticated
  with check ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_employee_profiles_owner_update
  on public.tibaldo_app_employee_profiles for update to authenticated
  using ((select private.tibaldo_app_has_role('OWNER')))
  with check ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_employee_profiles_owner_delete
  on public.tibaldo_app_employee_profiles for delete to authenticated
  using ((select private.tibaldo_app_has_role('OWNER')));

drop policy if exists allow_select_cleaner_payments on public.cleaner_payments;
drop policy if exists allow_insert_cleaner_payments on public.cleaner_payments;
drop policy if exists allow_delete_cleaner_payments on public.cleaner_payments;
drop policy if exists tibaldo_app_cleaner_payments_select on public.cleaner_payments;
drop policy if exists tibaldo_app_cleaner_payments_owner_insert on public.cleaner_payments;
drop policy if exists tibaldo_app_cleaner_payments_owner_delete on public.cleaner_payments;
revoke all on table public.cleaner_payments from anon, authenticated;
grant select, insert, delete on table public.cleaner_payments to authenticated;
create policy tibaldo_app_cleaner_payments_select
  on public.cleaner_payments for select to authenticated
  using ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_cleaner_payments_owner_insert
  on public.cleaner_payments for insert to authenticated
  with check ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_cleaner_payments_owner_delete
  on public.cleaner_payments for delete to authenticated
  using ((select private.tibaldo_app_has_role('OWNER')));

drop policy if exists housekeeping_entries_insert_anon on public.housekeeping_entries;
drop policy if exists housekeeping_entries_insert_authenticated on public.housekeeping_entries;
drop policy if exists housekeeping_entries_select_authenticated on public.housekeeping_entries;
drop policy if exists tibaldo_app_housekeeping_entries_select on public.housekeeping_entries;
drop policy if exists tibaldo_app_housekeeping_entries_insert on public.housekeeping_entries;
revoke all on table public.housekeeping_entries from anon, authenticated;
grant select, insert on table public.housekeeping_entries to authenticated;
create policy tibaldo_app_housekeeping_entries_select
  on public.housekeeping_entries for select to authenticated
  using ((select private.tibaldo_app_has_role('OWNER')));
create policy tibaldo_app_housekeeping_entries_insert
  on public.housekeeping_entries for insert to authenticated
  with check ((select private.tibaldo_app_has_role('OWNER')));

drop view if exists public.tibaldo_app_employee_housekeeping_entries;
drop view if exists public.tibaldo_app_employee_payment_history;

create or replace function private.tibaldo_app_read_housekeeping_private()
returns table (
  id uuid,
  employee_profile_id uuid,
  occurred_at timestamptz,
  property text,
  service_type text,
  minutes integer,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    entry.id,
    profile.id,
    entry.created_at,
    entry.property,
    entry.service_type,
    entry.minutes,
    entry.status
  from public.housekeeping_entries entry
  join public.tibaldo_app_employee_profiles profile
    on profile.staff_key = private.tibaldo_app_staff_key(entry.staff_name)
  where profile.active
    and (
      private.tibaldo_app_has_role('OWNER')
      or (
        private.tibaldo_app_has_role('EMPLOYEE')
        and profile.user_id = auth.uid()
      )
    )
  order by entry.created_at desc;
$$;

create or replace function private.tibaldo_app_read_payments_private()
returns table (
  id uuid,
  employee_profile_id uuid,
  payment_date date,
  amount numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    payment.id,
    profile.id,
    payment.payment_date,
    payment.amount
  from public.cleaner_payments payment
  join public.tibaldo_app_employee_profiles profile
    on profile.staff_key = private.tibaldo_app_staff_key(payment.cleaner_name)
  where profile.active
    and (
      private.tibaldo_app_has_role('OWNER')
      or (
        private.tibaldo_app_has_role('EMPLOYEE')
        and profile.user_id = auth.uid()
      )
    )
  order by payment.payment_date desc;
$$;

create or replace function public.tibaldo_app_read_housekeeping()
returns table (
  id uuid,
  employee_profile_id uuid,
  occurred_at timestamptz,
  property text,
  service_type text,
  minutes integer,
  status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.tibaldo_app_read_housekeeping_private();
$$;

create or replace function public.tibaldo_app_read_payments()
returns table (
  id uuid,
  employee_profile_id uuid,
  payment_date date,
  amount numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.tibaldo_app_read_payments_private();
$$;

revoke all on function private.tibaldo_app_read_housekeeping_private() from public, anon;
revoke all on function private.tibaldo_app_read_payments_private() from public, anon;
revoke all on function public.tibaldo_app_read_housekeeping() from public, anon;
revoke all on function public.tibaldo_app_read_payments() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.tibaldo_app_read_housekeeping_private() to authenticated;
grant execute on function private.tibaldo_app_read_payments_private() to authenticated;
grant execute on function public.tibaldo_app_read_housekeeping() to authenticated;
grant execute on function public.tibaldo_app_read_payments() to authenticated;

-- Existing Owner modules remain usable only by the exact OWNER membership.
-- Restrictive policies compose with, rather than replace, their current policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'animals', 'weights', 'tasks', 'ideas',
    'documents', 'document_lines', 'document_requirements', 'document_alerts',
    'airbnb_report_lines', 'airbnb_revenues', 'airbnb_profitability',
    'bank_category_rules', 'bank_statement_lines',
    'brain_edges', 'brain_links', 'brain_nodes', 'brain_projects',
    'business_revenue'
  ] loop
    if exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relkind in ('r', 'p')
    ) then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists tibaldo_app_owner_membership_gate on public.%I', table_name);
      execute format('drop policy if exists tibaldo_app_anonymous_denied on public.%I', table_name);
      execute format(
        'create policy tibaldo_app_owner_membership_gate on public.%I as restrictive for all to authenticated using ((select private.tibaldo_app_has_role(''OWNER''))) with check ((select private.tibaldo_app_has_role(''OWNER'')))',
        table_name
      );
      execute format(
        'create policy tibaldo_app_anonymous_denied on public.%I as restrictive for all to anon using (false) with check (false)',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Remove historical bucket-wide anonymous access while preserving the bounded
-- anonymous prestataire upload policy already used by the existing workflow.
drop policy if exists tibaldo_documents_select on storage.objects;
drop policy if exists tibaldo_documents_insert on storage.objects;
drop policy if exists tibaldo_documents_update on storage.objects;
drop policy if exists tibaldo_documents_delete on storage.objects;
drop policy if exists tibaldo_app_owner_membership_gate on storage.objects;
create policy tibaldo_app_owner_membership_gate
  on storage.objects as restrictive for all to authenticated
  using ((select private.tibaldo_app_has_role('OWNER')))
  with check ((select private.tibaldo_app_has_role('OWNER')));

comment on table public.tibaldo_app_opening_tasks is
  'Owner-only opening control center tasks for 26 September 2026.';
comment on table public.tibaldo_app_employee_profiles is
  'Minimal auth-to-existing-staff mapping. No employee ledger is duplicated.';
comment on function public.tibaldo_app_read_housekeeping() is
  'Bounded authorized projection of the existing housekeeping_entries source.';
comment on function public.tibaldo_app_read_payments() is
  'Bounded authorized projection of existing cleaner_payments; global Balance remains Owner-only.';
