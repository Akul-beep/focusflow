# Google Sign-in – Fix "OAuth state not found or expired"

## 1. Google Cloud Console

1. Go to **[Google Cloud Console](https://console.cloud.google.com)** → select your project (or create one).
2. **APIs & Services** → **Credentials**.
3. Open your **OAuth 2.0 Client ID** (Web application). If you don’t have one: **Create Credentials** → **OAuth client ID** → Application type: **Web application**.
4. **Authorized redirect URIs** – add **only** Supabase’s callback (not your app URL):

   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   Replace `YOUR_PROJECT_REF` with the ref from your Supabase URL (e.g. `https://abcdefgh.supabase.co` → use `abcdefgh`).

   Example: `https://xyzabc123.supabase.co/auth/v1/callback`

5. **Authorized JavaScript origins** (optional but recommended):
   - For local: `http://localhost:3000`
   - For Vercel: `https://your-app.vercel.app`
6. Save.

---

## 2. Supabase Dashboard

1. Go to **[Supabase Dashboard](https://supabase.com/dashboard)** → your project.
2. **Authentication** → **URL Configuration**.
3. **Site URL**
   - If you’re testing **locally**: `http://localhost:3000`
   - If you’re using **Vercel**: `https://your-app.vercel.app` (your real Vercel URL)
   - Must match where you actually open the app. Wrong value causes redirect/state issues.
4. **Redirect URLs** – add **both** (one per line):
   ```
   http://localhost:3000/auth/callback
   https://your-app.vercel.app/auth/callback
   ```
   Replace `your-app.vercel.app` with your real Vercel URL.
5. Save.

---

## 3. Why you see "OAuth state not found or expired"

- You **start** sign-in on one URL (e.g. Vercel) but **Site URL** in Supabase is `http://localhost:3000`, so Supabase sends the user back to localhost and state doesn’t match.
- Or you’re on **localhost** but the **redirect URL** in Supabase doesn’t include `http://localhost:3000/auth/callback`.
- Or the **Google** redirect URI is wrong (must be Supabase’s callback, not your app).

**Fix:** Use one environment at a time. If testing on **Vercel**, set Supabase **Site URL** to your Vercel URL and add that URL in **Redirect URLs**. If testing on **localhost**, set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` in **Redirect URLs**.

---

## 4. Supabase Auth → Providers (Google)

1. **Authentication** → **Providers** → **Google**.
2. Enable **Sign in with Google**.
3. Paste **Client ID** and **Client Secret** from Google Cloud Console (Credentials → your OAuth 2.0 Client ID).
4. Save.

---

## Quick checklist

- [ ] Google: Redirect URI = `https://YOUR_REF.supabase.co/auth/v1/callback` (no typo, no trailing slash).
- [ ] Supabase Site URL = the URL where you open the app (localhost **or** Vercel).
- [ ] Supabase Redirect URLs include both `http://localhost:3000/auth/callback` and `https://YOUR_VERCEL_URL/auth/callback`.
- [ ] Supabase Google provider: Client ID and Secret from Google Cloud Console.
