-- Persist feature tour completion in the cloud so returning users on a new browser are not prompted again.
alter table public.user_preferences
  add column if not exists feature_tour_completed boolean not null default false;

comment on column public.user_preferences.feature_tour_completed is 'True once the user finished or skipped the in-app feature tour; synced across devices.';
