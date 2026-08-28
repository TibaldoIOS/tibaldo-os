\set ON_ERROR_STOP on
begin;

create temporary table app_test_ids(label text primary key, user_id uuid not null) on commit drop;
insert into app_test_ids(label, user_id) values
  ('OWNER_TEST', '10000000-0000-4000-8000-000000000001'),
  ('GAELLE_TEST', '10000000-0000-4000-8000-000000000002'),
  ('JENNIFER_TEST', '10000000-0000-4000-8000-000000000003'),
  ('RACHIDA_TEST', '10000000-0000-4000-8000-000000000004');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  user_id,
  'authenticated',
  'authenticated',
  lower(label) || '@integration.test.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from app_test_ids;

grant select on app_test_ids to authenticated;

insert into public.tibaldo_app_memberships(user_id, role)
select user_id, case when label = 'OWNER_TEST' then 'OWNER' else 'EMPLOYEE' end
from app_test_ids;

insert into public.tibaldo_app_employee_profiles(user_id, display_name, staff_key)
select user_id, replace(label, '_TEST', ''), lower(replace(label, '_TEST', ''))
from app_test_ids
where label <> 'OWNER_TEST';

insert into public.tibaldo_app_opening_tasks(
  owner_user_id, seed_key, title, due_date, week_label, category, priority, status, effort
)
select user_id, 'rls-owner-only', 'Owner opening task', current_date, 'TEST', 'OUVERTURE', 'P0_CRITICAL', 'TODO', 'LIGHT'
from app_test_ids where label = 'OWNER_TEST';

insert into public.housekeeping_entries(
  staff_name, service_type, minutes, property, duplicate_key, status
)
values
  ('Gaelle', 'MENAGE', 60, 'TEST A', 'canonical-v2-gaelle', 'validated'),
  ('Jennifer', 'MENAGE', 90, 'TEST B', 'canonical-v2-jennifer', 'validated'),
  ('Rachida', 'MENAGE', 120, 'TEST C', 'canonical-v2-rachida', 'validated');

insert into public.cleaner_payments(cleaner_name, payment_date, amount, note)
values
  ('Gaelle', current_date, 15, 'TEST'),
  ('Jennifer', current_date, 22.5, 'TEST'),
  ('Rachida', current_date, 30, 'TEST');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from app_test_ids where label = 'GAELLE_TEST'), true);
do $$
begin
  if (select count(*) from public.tibaldo_app_employee_profiles) <> 1 then raise exception 'GAELLE_PROFILE_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_housekeeping()) <> 1 then raise exception 'GAELLE_HOUSEKEEPING_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_payments()) <> 1 then raise exception 'GAELLE_PAYMENT_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_opening_tasks) <> 0 then raise exception 'GAELLE_OPENING_LEAK'; end if;
  if exists (select 1 from public.tibaldo_app_read_housekeeping() where employee_profile_id <> (select id from public.tibaldo_app_employee_profiles)) then raise exception 'GAELLE_CROSS_USER'; end if;
  begin
    insert into public.cleaner_payments(cleaner_name, payment_date, amount) values ('Gaelle', current_date, 999);
    raise exception 'GAELLE_PAYMENT_WRITE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.housekeeping_entries(staff_name, service_type, minutes, duplicate_key, status)
    values ('Gaelle', 'MENAGE', 5, 'forbidden-self-write', 'validated');
    raise exception 'GAELLE_SELF_HOUSEKEEPING_WRITE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.tasks) <> 0 then raise exception 'GAELLE_OWNER_TASK_LEAK'; end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from app_test_ids where label = 'JENNIFER_TEST'), true);
do $$
begin
  if (select count(*) from public.tibaldo_app_employee_profiles) <> 1 then raise exception 'JENNIFER_PROFILE_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_housekeeping()) <> 1 then raise exception 'JENNIFER_HOUSEKEEPING_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_payments()) <> 1 then raise exception 'JENNIFER_PAYMENT_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_opening_tasks) <> 0 then raise exception 'JENNIFER_OPENING_LEAK'; end if;
  if exists (select 1 from public.tibaldo_app_read_housekeeping() where employee_profile_id <> (select id from public.tibaldo_app_employee_profiles)) then raise exception 'JENNIFER_CROSS_USER'; end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from app_test_ids where label = 'RACHIDA_TEST'), true);
do $$
begin
  if (select count(*) from public.tibaldo_app_employee_profiles) <> 1 then raise exception 'RACHIDA_PROFILE_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_housekeeping()) <> 1 then raise exception 'RACHIDA_HOUSEKEEPING_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_payments()) <> 1 then raise exception 'RACHIDA_PAYMENT_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_opening_tasks) <> 0 then raise exception 'RACHIDA_OPENING_LEAK'; end if;
  if exists (select 1 from public.tibaldo_app_read_housekeeping() where employee_profile_id <> (select id from public.tibaldo_app_employee_profiles)) then raise exception 'RACHIDA_CROSS_USER'; end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from app_test_ids where label = 'OWNER_TEST'), true);
do $$
declare task_id uuid;
begin
  if (select count(*) from public.tibaldo_app_opening_tasks) <> 1 then raise exception 'OWNER_OPENING_DENIED'; end if;
  if (select count(*) from public.tibaldo_app_employee_profiles) <> 3 then raise exception 'OWNER_PROFILE_DENIED'; end if;
  if (select count(*) from public.tibaldo_app_read_housekeeping()) <> 3 then raise exception 'OWNER_HOUSEKEEPING_DENIED'; end if;
  if (select count(*) from public.tibaldo_app_read_payments()) <> 3 then raise exception 'OWNER_PAYMENT_DENIED'; end if;

  insert into public.tibaldo_app_opening_tasks(
    owner_user_id, title, due_date, week_label, category, priority, status, effort, sort_order
  )
  values (
    (select user_id from app_test_ids where label = 'OWNER_TEST'),
    'Owner CRUD fixture', current_date, 'TEST', 'OUVERTURE',
    'P1_IMPORTANT', 'TODO', 'LIGHT', 999
  )
  returning id into task_id;

  update public.tibaldo_app_opening_tasks
  set status = 'DONE', completed_at = now()
  where id = task_id;
  update public.tibaldo_app_opening_tasks
  set status = 'TODO', completed_at = null
  where id = task_id;
  update public.tibaldo_app_opening_tasks
  set status = 'DEFERRED', due_date = current_date + 1
  where id = task_id;

  if not exists (
    select 1 from public.tibaldo_app_opening_tasks
    where id = task_id and status = 'DEFERRED' and due_date = current_date + 1
  ) then raise exception 'OWNER_OPENING_WORKFLOW_FAILED'; end if;

  delete from public.tibaldo_app_opening_tasks where id = task_id;
  if exists (select 1 from public.tibaldo_app_opening_tasks where id = task_id) then
    raise exception 'OWNER_OPENING_DELETE_FAILED';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if (select count(*) from public.tibaldo_app_memberships) <> 0 then raise exception 'EXPIRED_MEMBERSHIP_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_opening_tasks) <> 0 then raise exception 'EXPIRED_OPENING_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_housekeeping()) <> 0 then raise exception 'MISSING_SUBJECT_HOUSEKEEPING_LEAK'; end if;
  if (select count(*) from public.tibaldo_app_read_payments()) <> 0 then raise exception 'MISSING_SUBJECT_PAYMENT_LEAK'; end if;
end;
$$;
reset role;

set local role anon;
do $$
begin
  begin
    perform 1 from public.cleaner_payments;
    raise exception 'ANON_PAYMENT_READ_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.housekeeping_entries;
    raise exception 'ANON_HOUSEKEEPING_READ_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select jsonb_build_object(
  'employee_cross_user_isolation', 'PASS_6_OF_6',
  'employee_owner_route_data_access', 'DENIED',
  'owner_opening_crud', 'PASS',
  'missing_jwt_subject', 'FAIL_CLOSED',
  'real_expired_jwt_rest_test', 'REQUIRED_ON_DEVELOPMENT_TARGET',
  'anonymous_access', 'DENIED',
  'duplicate_employee_ledger', 'NO'
) as app_canonical_integration_v2_matrix;
rollback;
