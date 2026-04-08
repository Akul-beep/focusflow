-- Optional: run in Supabase SQL editor if user_preferences exists without this column.
alter table public.user_preferences
  add column if not exists schedule_grade_level text;

comment on column public.user_preferences.schedule_grade_level is 'Student grade/program for AI study-time calibration (e.g. MYP 5, IB DP)';
