-- Persist FG Admin permission matrix overrides (diff from app defaults in code).
-- Full effective matrix = merge(code defaults, this JSONB).
-- (Copy lives in showcaseit docs for teams that track SQL here; app source may use supabase/migrations/.)

create table if not exists public.fg_permission_matrix_config (
  id smallint primary key,
  matrix jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id) on delete set null,
  constraint fg_permission_matrix_config_singleton check (id = 1)
);

insert into public.fg_permission_matrix_config (id, matrix)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.fg_permission_matrix_config enable row level security;

drop policy if exists fg_permission_matrix_config_select_fg on public.fg_permission_matrix_config;
create policy fg_permission_matrix_config_select_fg
  on public.fg_permission_matrix_config
  for select
  to authenticated
  using (
    exists (select 1 from public.fg_admins f where f.user_id = (select auth.uid()))
  );

drop policy if exists fg_permission_matrix_config_update_fg on public.fg_permission_matrix_config;
create policy fg_permission_matrix_config_update_fg
  on public.fg_permission_matrix_config
  for update
  to authenticated
  using (
    exists (select 1 from public.fg_admins f where f.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.fg_admins f where f.user_id = (select auth.uid()))
  );

drop policy if exists fg_permission_matrix_config_insert_fg on public.fg_permission_matrix_config;
create policy fg_permission_matrix_config_insert_fg
  on public.fg_permission_matrix_config
  for insert
  to authenticated
  with check (
    exists (select 1 from public.fg_admins f where f.user_id = (select auth.uid()))
  );

grant select, insert, update on public.fg_permission_matrix_config to authenticated;
