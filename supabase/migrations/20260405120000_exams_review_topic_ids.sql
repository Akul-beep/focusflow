-- Flags syllabus topics the student wants to revisit (exam detail page).
alter table if exists exams
  add column if not exists review_topic_ids jsonb not null default '[]'::jsonb;
