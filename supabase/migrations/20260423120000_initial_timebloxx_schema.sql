create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'block_source') then
    create type public.block_source as enum ('one-time', 'template');
  end if;

  if not exists (select 1 from pg_type where typname = 'todo_source') then
    create type public.todo_source as enum ('local', 'todoist');
  end if;
end
$$;

create table if not exists public.planner_profiles (
  owner_id text primary key check (length(trim(owner_id)) > 0),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_block_templates (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  id text not null,
  title text not null,
  description text not null default '',
  default_duration_min integer not null check (default_duration_min > 0),
  category text not null default 'General',
  color text not null,
  is_variable_duration boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists idx_time_block_templates_owner_created
  on public.time_block_templates (owner_id, created_at);

create table if not exists public.habits (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  id text not null,
  name text not null,
  category text not null default 'General',
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (owner_id, id)
);

create index if not exists idx_habits_owner_order on public.habits (owner_id, "order");

create table if not exists public.planner_days (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  top_priority_1 text not null default '',
  top_priority_2 text not null default '',
  top_priority_3 text not null default '',
  primary key (owner_id, date_key)
);

create table if not exists public.day_time_blocks (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  id text not null,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  duration_min integer not null check (duration_min > 0),
  start_time text,
  actual_duration_min integer check (actual_duration_min is null or actual_duration_min > 0),
  actual_start_time text,
  color text not null,
  completed boolean not null default false,
  source public.block_source not null,
  template_id text,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  foreign key (owner_id, template_id)
    references public.time_block_templates (owner_id, id)
    on delete set null
);

create index if not exists idx_day_time_blocks_owner_date_order
  on public.day_time_blocks (owner_id, date_key, "order");

create table if not exists public.day_todos (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  id text not null,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  text text not null,
  due_time text,
  completed boolean not null default false,
  source public.todo_source not null default 'local',
  external_id text,
  labels text[] not null default '{}',
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists idx_day_todos_owner_date_order
  on public.day_todos (owner_id, date_key, "order");

create table if not exists public.day_habit_checks (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  habit_id text not null,
  checked boolean not null default true,
  primary key (owner_id, date_key, habit_id),
  foreign key (owner_id, habit_id)
    references public.habits (owner_id, id)
    on delete cascade
);

create index if not exists idx_day_habit_checks_owner_date
  on public.day_habit_checks (owner_id, date_key);

create table if not exists public.weekly_task_bank_todos (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  id text not null,
  week_key text not null check (week_key ~ '^\d{4}-\d{2}-\d{2}$'),
  text text not null,
  due_time text,
  completed boolean not null default false,
  source public.todo_source not null default 'local',
  external_id text,
  labels text[] not null default '{}',
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists idx_weekly_task_bank_owner_week_order
  on public.weekly_task_bank_todos (owner_id, week_key, "order");

create table if not exists public.weekly_block_bank_blocks (
  owner_id text not null references public.planner_profiles (owner_id) on delete cascade,
  id text not null,
  week_key text not null check (week_key ~ '^\d{4}-\d{2}-\d{2}$'),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  duration_min integer not null check (duration_min > 0),
  start_time text,
  actual_duration_min integer check (actual_duration_min is null or actual_duration_min > 0),
  actual_start_time text,
  color text not null,
  completed boolean not null default false,
  source public.block_source not null,
  template_id text,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  foreign key (owner_id, template_id)
    references public.time_block_templates (owner_id, id)
    on delete set null
);

create index if not exists idx_weekly_block_bank_owner_week_order
  on public.weekly_block_bank_blocks (owner_id, week_key, "order");

create table if not exists public.todoist_settings (
  owner_id text primary key references public.planner_profiles (owner_id) on delete cascade,
  api_token text,
  last_sync_at timestamptz
);

create or replace function public.is_owner(p_owner_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.planner_profiles profile
    where profile.owner_id = p_owner_id
      and profile.auth_user_id = auth.uid()
  );
$$;

grant execute on function public.is_owner(text) to anon, authenticated, service_role;

alter table public.planner_profiles enable row level security;
alter table public.time_block_templates enable row level security;
alter table public.habits enable row level security;
alter table public.planner_days enable row level security;
alter table public.day_time_blocks enable row level security;
alter table public.day_todos enable row level security;
alter table public.day_habit_checks enable row level security;
alter table public.weekly_task_bank_todos enable row level security;
alter table public.weekly_block_bank_blocks enable row level security;
alter table public.todoist_settings enable row level security;

drop policy if exists planner_profiles_select on public.planner_profiles;
create policy planner_profiles_select
  on public.planner_profiles for select
  using (auth.role() = 'service_role' or auth.uid() = auth_user_id);

drop policy if exists planner_profiles_insert on public.planner_profiles;
create policy planner_profiles_insert
  on public.planner_profiles for insert
  with check (
    auth.role() = 'service_role'
    or (auth_user_id is not null and auth.uid() = auth_user_id)
  );

drop policy if exists planner_profiles_update on public.planner_profiles;
create policy planner_profiles_update
  on public.planner_profiles for update
  using (auth.role() = 'service_role' or auth.uid() = auth_user_id)
  with check (auth.role() = 'service_role' or auth.uid() = auth_user_id);

drop policy if exists planner_profiles_delete on public.planner_profiles;
create policy planner_profiles_delete
  on public.planner_profiles for delete
  using (auth.role() = 'service_role' or auth.uid() = auth_user_id);

drop policy if exists time_block_templates_owner_all on public.time_block_templates;
create policy time_block_templates_owner_all
  on public.time_block_templates for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists habits_owner_all on public.habits;
create policy habits_owner_all
  on public.habits for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists planner_days_owner_all on public.planner_days;
create policy planner_days_owner_all
  on public.planner_days for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists day_time_blocks_owner_all on public.day_time_blocks;
create policy day_time_blocks_owner_all
  on public.day_time_blocks for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists day_todos_owner_all on public.day_todos;
create policy day_todos_owner_all
  on public.day_todos for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists day_habit_checks_owner_all on public.day_habit_checks;
create policy day_habit_checks_owner_all
  on public.day_habit_checks for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists weekly_task_bank_todos_owner_all on public.weekly_task_bank_todos;
create policy weekly_task_bank_todos_owner_all
  on public.weekly_task_bank_todos for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists weekly_block_bank_blocks_owner_all on public.weekly_block_bank_blocks;
create policy weekly_block_bank_blocks_owner_all
  on public.weekly_block_bank_blocks for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));

drop policy if exists todoist_settings_owner_all on public.todoist_settings;
create policy todoist_settings_owner_all
  on public.todoist_settings for all
  using (auth.role() = 'service_role' or public.is_owner(owner_id))
  with check (auth.role() = 'service_role' or public.is_owner(owner_id));
