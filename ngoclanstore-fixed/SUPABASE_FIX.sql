-- Ngoc Lan Store: fix Auth profile table and RLS
-- Run once in Supabase Dashboard -> SQL Editor.
-- This project uses public.users (NOT public.profiles).

begin;

-- 1) Ensure the public profile table has the columns used by the app.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  name text,
  phone text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists email text;
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists name text;
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists role text default 'user';
alter table public.users add column if not exists created_at timestamptz default now();
alter table public.users add column if not exists updated_at timestamptz default now();

-- Stop early with a clear message if the existing id column is not UUID.
do $$
declare
  id_type text;
begin
  select udt_name into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'users'
    and column_name = 'id';

  if id_type is distinct from 'uuid' then
    raise exception 'public.users.id must be uuid, current type: %', id_type;
  end if;
end;
$$;

update public.users
set role = 'user'
where role is null or trim(role::text) = '';

create unique index if not exists users_id_unique_idx on public.users(id);

alter table public.users alter column role set default 'user';
alter table public.users alter column created_at set default now();
alter table public.users alter column updated_at set default now();

-- 2) Create one public.users row whenever Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (
    id,
    email,
    full_name,
    name,
    role,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    'user',
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(public.users.full_name, ''), excluded.full_name),
      name = coalesce(nullif(public.users.name, ''), excluded.name),
      role = coalesce(public.users.role, 'user'),
      updated_at = now();

  return new;
end;
$$;

-- Remove common old trigger names, then create the canonical trigger.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists create_profile_after_signup on auth.users;
drop trigger if exists handle_new_user_trigger on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 3) Backfill profiles for Auth users that already exist.
insert into public.users (
  id,
  email,
  full_name,
  name,
  role,
  created_at,
  updated_at
)
select
  au.id,
  au.email,
  coalesce(
    nullif(au.raw_user_meta_data ->> 'full_name', ''),
    nullif(au.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(au.email, ''), '@', 1)
  ),
  coalesce(
    nullif(au.raw_user_meta_data ->> 'name', ''),
    nullif(au.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(au.email, ''), '@', 1)
  ),
  'user',
  coalesce(au.created_at, now()),
  now()
from auth.users au
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(nullif(public.users.full_name, ''), excluded.full_name),
    name = coalesce(nullif(public.users.name, ''), excluded.name),
    role = coalesce(public.users.role, 'user'),
    updated_at = now();

-- 4) Secure helper used by RLS policies.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- 5) RLS for public.users.
alter table public.users enable row level security;

grant usage on schema public to authenticated;
grant select on public.users to authenticated;

-- A normal user may edit profile fields but cannot grant themselves admin.
revoke insert, delete, update on public.users from anon, authenticated;
grant update (full_name, phone, updated_at) on public.users to authenticated;

drop policy if exists "users_select_own_profile" on public.users;
drop policy if exists "users_select_own_or_admin" on public.users;
drop policy if exists "users_update_own_profile" on public.users;
drop policy if exists "app_users_select_own" on public.users;
drop policy if exists "app_users_update_own" on public.users;

create policy "users_select_own_or_admin"
on public.users
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

create policy "users_update_own_profile"
on public.users
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- 6) Add existing tables to Realtime publication only when present.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['products', 'orders', 'cart_items', 'favorites']
  loop
    if to_regclass(format('public.%I', table_name)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;

-- Optional: promote your own account after the main transaction succeeds.
-- Replace the email below, uncomment, and run separately:
-- update public.users set role = 'admin', updated_at = now()
-- where email = 'your-email@example.com';
