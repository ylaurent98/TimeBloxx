# Supabase Setup

This project now includes the full database schema at:

- `supabase/migrations/20260423120000_initial_timebloxx_schema.sql`

## Apply in Supabase (Dashboard)

1. Open your Supabase project.
2. Go to `SQL Editor`.
3. Paste and run the SQL from the migration file above.

After it runs, all app tables are created in `public` and exposed through Supabase with RLS enabled.
The schema is designed for:

- importing data before auth exists (`owner_id`)
- attaching that data to a real auth user later (`auth_user_id` in `planner_profiles`)

## Tables created

- `planner_profiles`
- `time_block_templates`
- `habits`
- `planner_days`
- `day_time_blocks`
- `day_todos`
- `day_habit_checks`
- `weekly_task_bank_todos`
- `weekly_block_bank_blocks`
- `todoist_settings`

## Import current Edge local data now

### 1) Export localStorage from Edge

Open your app in Edge, then DevTools Console:

```js
copy(localStorage.getItem("timebloxx.planner.v1"));
```

Create a file in the project root named `planner-export.json` and paste what was copied.

### 2) Run importer to Supabase

PowerShell example:

```powershell
$env:SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
$env:OWNER_ID="edge-laptop-main"
npm run import:edge -- planner-export.json
```

This imports all planner tables for that `OWNER_ID`.

## Link imported owner data to auth later

When auth is added and the user signs in, set the matching `auth_user_id` on the profile:

```sql
update public.planner_profiles
set auth_user_id = 'YOUR_AUTH_USER_UUID'
where owner_id = 'edge-laptop-main';
```

After that, authenticated requests can use RLS by user identity.
