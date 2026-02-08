# Supabase Setup Guide

This guide will walk you through setting up Supabase for Google authentication and database storage.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign in" if you already have an account
3. Click "New Project"
4. Fill in the project details:
   - **Name**: `focusflow` (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to you
   - **Pricing Plan**: Free tier is fine for development
5. Click "Create new project"
6. Wait 2-3 minutes for the project to be set up

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, click on the **Settings** icon (gear icon) in the left sidebar
2. Click **API** in the settings menu
3. You'll see two important values:
   - **Project URL** (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon public** key (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Copy both values - you'll need them in the next step

## Step 3: Configure Google OAuth

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list and click on it
3. Toggle "Enable Google provider" to ON
4. You'll need to create a Google OAuth application:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or select existing)
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Choose **Web application**
   - Add authorized redirect URIs:
     - `https://<your-project-ref>.supabase.co/auth/v1/callback`
     - For local development: `http://localhost:3000/auth/callback`
   - Copy the **Client ID** and **Client Secret**
5. Back in Supabase, paste:
   - **Client ID (for OAuth)**: Your Google OAuth Client ID
   - **Client Secret (for OAuth)**: Your Google OAuth Client Secret
6. Click **Save**

## Step 4: Add Environment Variables

1. Open your `.env.local` file in the project root
2. Add these lines (replace with your actual values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Your complete `.env.local` should look like:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 5: Set Up Database Tables (Optional - for future data sync)

When you're ready to sync user data to Supabase, you'll need to create these tables. For now, authentication will work without them.

### SQL to create tables (run in Supabase SQL Editor):

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  subject TEXT,
  completed BOOLEAN DEFAULT FALSE,
  estimated_total_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Micro tasks table
CREATE TABLE IF NOT EXISTS public.micro_tasks (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  estimated_minutes INTEGER,
  order_index INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  scheduled_date DATE,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pomodoro sessions table
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES public.tasks(id) ON DELETE SET NULL,
  micro_task_id TEXT REFERENCES public.micro_tasks(id) ON DELETE SET NULL,
  duration INTEGER,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT FALSE,
  type TEXT CHECK (type IN ('focus', 'break')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User stats table
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  tasks_completed INTEGER DEFAULT 0,
  micro_tasks_completed INTEGER DEFAULT 0,
  total_focus_minutes INTEGER DEFAULT 0,
  weekly_goal INTEGER DEFAULT 20,
  weekly_completed DECIMAL DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  focus_coins INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  focus_coins_today INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Create policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own tasks" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables...
CREATE POLICY "Users can manage own micro tasks" ON public.micro_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own pomodoro sessions" ON public.pomodoro_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own stats" ON public.user_stats
  FOR ALL USING (auth.uid() = user_id);
```

## Step 6: Test the Setup

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the Settings page: `http://localhost:3000/settings`

3. Click "Sign in with Google"

4. You should be redirected to Google's sign-in page

5. After signing in, you'll be redirected back to the settings page

6. You should see your email address displayed, confirming you're signed in

## Troubleshooting

### "Supabase environment variables are not set"
- Make sure you've added `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
- Restart your dev server after adding environment variables

### "Failed to sign in"
- Check that Google OAuth is enabled in Supabase
- Verify your Google OAuth redirect URI matches: `https://<your-project-ref>.supabase.co/auth/v1/callback`
- Make sure your Google OAuth credentials are correct

### Redirect URI mismatch
- In Google Cloud Console, make sure you've added both:
  - Production: `https://<your-project-ref>.supabase.co/auth/v1/callback`
  - Development: `http://localhost:3000/auth/callback`

## Next Steps

Once authentication is working, you can:
1. Implement data synchronization to Supabase
2. Add user profiles
3. Enable cross-device data sync
4. Add backup/restore functionality

## Important Notes

- The `NEXT_PUBLIC_` prefix is required for client-side environment variables in Next.js
- Never commit `.env.local` to version control
- The anon key is safe to expose in client-side code (it's protected by Row Level Security)
- For production, consider using environment-specific Supabase projects
