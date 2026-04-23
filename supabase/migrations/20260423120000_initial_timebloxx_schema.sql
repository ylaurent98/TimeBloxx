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
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.time_block_templates (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  default_duration_min integer not null check (default_duration_min > 0),
  category text not null default 'General',
  color text not null,
  is_variable_duration boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_block_templates_user_created
  on public.time_block_templates (user_id, created_at);

create table if not exists public.habits (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null default 'General',
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_habits_user_order on public.habits (user_id, "order");

create table if not exists public.planner_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  top_priority_1 text not null default '',
  top_priority_2 text not null default '',
  top_priority_3 text not null default '',
  primary key (user_id, date_key)
);

create table if not exists public.day_time_blocks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
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
  template_id text references public.time_block_templates (id) on delete set null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_day_time_blocks_user_date_order
  on public.day_time_blocks (user_id, date_key, "order");

create table if not exists public.day_todos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  text text not null,
  due_time text,
  completed boolean not null default false,
  source public.todo_source not null default 'local',
  external_id text,
  labels text[] not null default '{}',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_day_todos_user_date_order
  on public.day_todos (user_id, date_key, "order");

create table if not exists public.day_habit_checks (
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  habit_id text not null references public.habits (id) on delete cascade,
  checked boolean not null default true,
  primary key (user_id, date_key, habit_id)
);

create index if not exists idx_day_habit_checks_user_date
  on public.day_habit_checks (user_id, date_key);

create table if not exists public.weekly_task_bank_todos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_key text not null check (week_key ~ '^\d{4}-\d{2}-\d{2}$'),
  text text not null,
  due_time text,
  completed boolean not null default false,
  source public.todo_source not null default 'local',
  external_id text,
  labels text[] not null default '{}',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_weekly_task_bank_user_week_order
  on public.weekly_task_bank_todos (user_id, week_key, "order");

create table if not exists public.weekly_block_bank_blocks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
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
  template_id text references public.time_block_templates (id) on delete set null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_weekly_block_bank_user_week_order
  on public.weekly_block_bank_blocks (user_id, week_key, "order");

create table if not exists public.todoist_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  api_token text,
  last_sync_at timestamptz
);

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

drop policy if exists "planner_profiles_owner_select" on public.planner_profiles;
create policy "planner_profiles_owner_select"
  on public.planner_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "planner_profiles_owner_insert" on public.planner_profiles;
create policy "planner_profiles_owner_insert"
  on public.planner_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "planner_profiles_owner_update" on public.planner_profiles;
create policy "planner_profiles_owner_update"
  on public.planner_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "planner_profiles_owner_delete" on public.planner_profiles;
create policy "planner_profiles_owner_delete"
  on public.planner_profiles for delete
  using (auth.uid() = user_id);

drop policy if exists "time_block_templates_owner_all" on public.time_block_templates;
create policy "time_block_templates_owner_all"
  on public.time_block_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "habits_owner_all" on public.habits;
create policy "habits_owner_all"
  on public.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "planner_days_owner_all" on public.planner_days;
create policy "planner_days_owner_all"
  on public.planner_days for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "day_time_blocks_owner_all" on public.day_time_blocks;
create policy "day_time_blocks_owner_all"
  on public.day_time_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "day_todos_owner_all" on public.day_todos;
create policy "day_todos_owner_all"
  on public.day_todos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "day_habit_checks_owner_all" on public.day_habit_checks;
create policy "day_habit_checks_owner_all"
  on public.day_habit_checks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "weekly_task_bank_todos_owner_all" on public.weekly_task_bank_todos;
create policy "weekly_task_bank_todos_owner_all"
  on public.weekly_task_bank_todos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "weekly_block_bank_blocks_owner_all" on public.weekly_block_bank_blocks;
create policy "weekly_block_bank_blocks_owner_all"
  on public.weekly_block_bank_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "todoist_settings_owner_all" on public.todoist_settings;
create policy "todoist_settings_owner_all"
  on public.todoist_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
