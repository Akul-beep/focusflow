-- Optional: bookmarked syllabus topics per exam (syncs with app `reviewTopicIds`).
alter table if exists exams
  add column if not exists review_topic_ids jsonb not null default '[]'::jsonb;
