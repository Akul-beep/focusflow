-- Focusflow schema extensions (run AFTER `supabase-migration.sql` in the Supabase SQL Editor)
-- Adds tables and columns expected by `lib/supabase-sync.ts`.

-- ---------------------------------------------------------------------------
-- user_preferences: fields used by the app but missing from the base migration
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS schedule_grade_level TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS schedule_study_pace TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS calendar_event_color TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS calendar_task_color TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS motivation_daily_briefing BOOLEAN;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS schedule_weekend_start TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS schedule_weekend_end TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS schedule_no_task_dates JSONB;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS theme_preference TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_is_student BOOLEAN;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS feature_tour_completed BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- micro_tasks: exam planner link
-- ---------------------------------------------------------------------------
ALTER TABLE public.micro_tasks
  ADD COLUMN IF NOT EXISTS exam_id TEXT;

-- ---------------------------------------------------------------------------
-- notes (To-do / Apple Notes content)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  linked_session_id TEXT
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notes" ON public.notes;
CREATE POLICY "Users can manage own notes" ON public.notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

-- ---------------------------------------------------------------------------
-- exams (syllabus / prep)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  daily_hours NUMERIC NOT NULL DEFAULT 2,
  topics JSONB DEFAULT '[]'::jsonb,
  covered_topic_ids JSONB DEFAULT '[]'::jsonb,
  review_topic_ids JSONB DEFAULT '[]'::jsonb,
  sessions_generated BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own exams" ON public.exams;
CREATE POLICY "Users can manage own exams" ON public.exams
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exams_user_id ON public.exams(user_id);

-- ---------------------------------------------------------------------------
-- onboarding profile (higher-fidelity setup answers for personalization)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_onboarding_profiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role_label TEXT NOT NULL DEFAULT 'student',
  program_label TEXT,
  weekday_start TEXT NOT NULL DEFAULT '16:00',
  weekday_end TEXT NOT NULL DEFAULT '21:30',
  weekend_start TEXT NOT NULL DEFAULT '10:00',
  weekend_end TEXT NOT NULL DEFAULT '18:00',
  study_pace TEXT NOT NULL DEFAULT 'balanced',
  prefers_dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
  theme_preference TEXT NOT NULL DEFAULT 'system',
  daily_briefing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  personal_goal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.user_onboarding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own onboarding profile" ON public.user_onboarding_profiles;
CREATE POLICY "Users can manage own onboarding profile" ON public.user_onboarding_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_profiles_updated_at
  ON public.user_onboarding_profiles(updated_at);

DROP TRIGGER IF EXISTS update_user_onboarding_profiles_updated_at ON public.user_onboarding_profiles;
CREATE TRIGGER update_user_onboarding_profiles_updated_at
  BEFORE UPDATE ON public.user_onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- AI: encrypted BYOK Groq key + shared-key daily quota (per user, UTC day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_ai_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  groq_key_ciphertext TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ai_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own AI credentials" ON public.user_ai_credentials;
CREATE POLICY "Users manage own AI credentials" ON public.user_ai_credentials
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_updated_at ON public.user_ai_credentials(updated_at);

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  shared_ai_calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own AI usage" ON public.ai_usage_daily;
CREATE POLICY "Users read own AI usage" ON public.ai_usage_daily
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_shared_ai_slot(p_limit integer)
RETURNS TABLE (allowed boolean, used_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  d date := (timezone('utc', now()))::date;
  cur int := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, usage_date, shared_ai_calls)
  VALUES (uid, d, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT a.shared_ai_calls INTO cur
  FROM public.ai_usage_daily a
  WHERE a.user_id = uid AND a.usage_date = d;

  IF COALESCE(cur, 0) >= p_limit THEN
    RETURN QUERY SELECT false, COALESCE(cur, p_limit);
    RETURN;
  END IF;

  UPDATE public.ai_usage_daily a
  SET shared_ai_calls = a.shared_ai_calls + 1
  WHERE a.user_id = uid AND a.usage_date = d AND a.shared_ai_calls < p_limit
  RETURNING a.shared_ai_calls INTO cur;

  IF FOUND THEN
    RETURN QUERY SELECT true, cur;
  ELSE
    SELECT a.shared_ai_calls INTO cur FROM public.ai_usage_daily a WHERE a.user_id = uid AND a.usage_date = d;
    RETURN QUERY SELECT false, COALESCE(cur, p_limit);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_shared_ai_slot(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_shared_ai_slot(integer) TO authenticated;
