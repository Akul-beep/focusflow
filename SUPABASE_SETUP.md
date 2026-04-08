# Supabase Setup Guide

This guide will walk you through setting up Supabase for Google authentication and database storage.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign in" if you already have an account
3. Click "New Project"
4. Fill in the project details:
   - **Name**: `flowly` (or any name you prefer)
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
GEMINI_MODEL=gemini-3.1-flash-lite

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 5: Set Up Database Tables (required for sync)

The app syncs tasks, calendar events, notes, exams, stats, and preferences to Postgres. Run these **in order** in the Supabase **SQL Editor**:

1. **`supabase-migration.sql`** — base tables, RLS, and indexes.
2. **`supabase-schema-extensions.sql`** — `notes`, `exams`, `micro_tasks.exam_id`, onboarding tables, weekend availability fields, dark mode/theme preference, no-scheduling-day persistence, extra `user_preferences` columns, **and** `user_ai_credentials` + `ai_usage_daily` + `consume_shared_ai_slot()` for optional per-user Groq keys and shared-AI daily limits.

If you skip (2), uploads may fail with “column does not exist” or missing tables.

### Email + password sign-up

1. In Supabase: **Authentication** → **Providers** → enable **Email**.
2. Under **URL configuration**, add to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://your-production-domain/auth/callback` (prod)

Google OAuth still uses the same `/auth/callback` route.

### Sign-in gate (production)

When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, **middleware** sends unauthenticated visitors to **`/login`**. Without those env vars, the app stays **local-only** (no login wall) for offline development.

## Step 6: Test the Setup

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Open `http://localhost:3000` — you should be redirected to **`/login`** when Supabase env is set.

3. Use **Sign up** or **Google** on `/login` or `/signup`.

4. After OAuth, you land on `/` or the `next` path; open **Settings** to confirm your email and use **Sync** / **Re-run scheduling** as needed.

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
