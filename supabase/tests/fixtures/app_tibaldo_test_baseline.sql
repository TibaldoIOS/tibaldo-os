-- TEST-only structural clone of the existing app.tibaldo.fr tables required by
-- the integration BETA. No production data is copied.

create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  name text not null,
  emoji text,
  type text,
  status text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  animal_id uuid references public.animals(id),
  animal_key text,
  animal_name text,
  date date not null,
  weight numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  title text not null,
  description text,
  category text,
  priority text default 'moyenne',
  date date,
  time text,
  done boolean not null default false,
  source text default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  title text not null,
  description text,
  category text,
  priority text default 'moyenne',
  status text default 'a_traiter',
  done boolean not null default false,
  week_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.housekeeping_entries (
  id uuid primary key default gen_random_uuid(),
  staff_name text not null,
  service_type text not null,
  minutes integer,
  purchase_done boolean default false,
  purchased_products text[],
  purchase_products_other text,
  purchase_amount numeric default 0,
  ticket_paths text[],
  property text,
  surfaces text[],
  rooms text[],
  remarks text,
  linen_pairs integer,
  photo_paths text[],
  mission_description text,
  duplicate_key text not null,
  status text not null default 'validated',
  created_at timestamptz not null default now(),
  source_row text
);

create table if not exists public.cleaner_payments (
  id uuid primary key default gen_random_uuid(),
  cleaner_name text not null,
  payment_date date not null default current_date,
  amount numeric not null,
  note text,
  created_at timestamptz default now()
);

alter table public.animals enable row level security;
alter table public.weights enable row level security;
alter table public.tasks enable row level security;
alter table public.ideas enable row level security;
alter table public.housekeeping_entries enable row level security;
alter table public.cleaner_payments enable row level security;

grant select, insert, update, delete on public.animals, public.weights, public.tasks, public.ideas to authenticated;
grant select, insert on public.housekeeping_entries to anon, authenticated;
grant select, insert, delete on public.cleaner_payments to anon, authenticated;

drop policy if exists animals_select_own on public.animals;
drop policy if exists animals_insert_own on public.animals;
drop policy if exists animals_update_own on public.animals;
drop policy if exists animals_delete_own on public.animals;
create policy animals_select_own on public.animals for select to authenticated using ((select auth.uid()) = user_id);
create policy animals_insert_own on public.animals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy animals_update_own on public.animals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy animals_delete_own on public.animals for delete to authenticated using ((select auth.uid()) = user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['weights', 'tasks', 'ideas'] loop
    execute format('drop policy if exists %I_select_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_insert_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_update_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_delete_own on public.%I', table_name, table_name);
    execute format('create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name, table_name);
  end loop;
end;
$$;

drop policy if exists housekeeping_entries_insert_anon on public.housekeeping_entries;
drop policy if exists housekeeping_entries_insert_authenticated on public.housekeeping_entries;
drop policy if exists housekeeping_entries_select_authenticated on public.housekeeping_entries;
create policy housekeeping_entries_insert_anon on public.housekeeping_entries for insert to anon with check (true);
create policy housekeeping_entries_insert_authenticated on public.housekeeping_entries for insert to authenticated with check (true);
create policy housekeeping_entries_select_authenticated on public.housekeeping_entries for select to authenticated using (true);

drop policy if exists allow_select_cleaner_payments on public.cleaner_payments;
drop policy if exists allow_insert_cleaner_payments on public.cleaner_payments;
drop policy if exists allow_delete_cleaner_payments on public.cleaner_payments;
create policy allow_select_cleaner_payments on public.cleaner_payments for select to public using (true);
create policy allow_insert_cleaner_payments on public.cleaner_payments for insert to public with check (true);
create policy allow_delete_cleaner_payments on public.cleaner_payments for delete to public using (true);

comment on table public.housekeeping_entries is
  'TEST-only structural clone of the existing app.tibaldo.fr Ménage register.';
comment on table public.cleaner_payments is
  'TEST-only structural clone of the existing app.tibaldo.fr Virements register.';
