# Supabase Setup

This project now includes the full database schema at:

- `supabase/migrations/20260423120000_initial_timebloxx_schema.sql`

## Apply in Supabase (Dashboard)

1. Open your Supabase project.
2. Go to `SQL Editor`.
3. Paste and run the SQL from the migration file above.

After it runs, all app tables are created in `public` and exposed through Supabase with RLS enabled.

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
