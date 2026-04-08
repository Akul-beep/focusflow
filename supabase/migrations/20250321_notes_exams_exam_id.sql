-- Run in Supabase SQL editor if these objects are missing.
-- Links exam planner steps to exams and stores rich notes.

alter table if exists micro_tasks
  add column if not exists exam_id text;

create table if not exists notes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  linked_session_id text
);

create table if not exists exams (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  subject text not null,
  exam_date date not null,
  daily_hours numeric not null default 2,
  topics jsonb not null default '[]'::jsonb,
  covered_topic_ids jsonb not null default '[]'::jsonb,
  sessions_generated boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notes enable row level security;
alter table exams enable row level security;

create policy "notes_own" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exams_own" on exams for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
