# Deploy Focusflow to Vercel

## 1. Push your code to GitHub

If you haven’t already:

```bash
cd student-scheduler
git add .
git commit -m "Ready for Vercel deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

(Create the repo on GitHub first: https://github.com/new)

---

## 2. Deploy on Vercel

1. Go to **https://vercel.com** and sign in (GitHub is easiest).
2. Click **Add New…** → **Project**.
3. **Import** your GitHub repo (the one that contains `student-scheduler`).
4. **Root Directory:** If your repo is only the app, leave as `.`.  
   If the repo is the whole project (e.g. "IB Design MYP5") and the app is in a subfolder, set **Root Directory** to `student-scheduler`.
5. **Framework Preset:** Next.js (auto-detected).
6. **Build Command:** `npm run build` (default).
7. **Output Directory:** leave default.
8. **Install Command:** `npm install` (default).

---

## 3. Environment variables

In the Vercel project import screen (or later: **Project → Settings → Environment Variables**), add:

| Name | Value | Notes |
|------|--------|--------|
| `GEMINI_API_KEY` | Your Gemini API key | From Google AI Studio |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Optional; this is the default |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | From Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon/public key | From Supabase → Settings → API |

- Add them for **Production** (and optionally Preview if you want).
- Do **not** commit `.env.local`; Vercel uses these variables instead.

---

## 4. Supabase redirect URL (for Google Sign-in)

After your first deploy, you’ll get a URL like `https://your-app.vercel.app`.

1. Open **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add:
   - `https://your-app.vercel.app/auth/callback`
   - `https://*.vercel.app/auth/callback` (optional; for preview deployments)

Save. Google Sign-in will then work on your Vercel domain.

---

## 5. Deploy

Click **Deploy**. Vercel will build and deploy. When it’s done, open the provided URL (e.g. `https://student-scheduler-xxx.vercel.app`).

---

## 6. Custom domain (optional)

In Vercel: **Project → Settings → Domains** → add your domain and follow the DNS instructions.

---

## Quick checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created and repo connected
- [ ] Root directory set to `student-scheduler` if app is in a subfolder
- [ ] `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel
- [ ] Supabase redirect URL includes `https://YOUR_VERCEL_URL/auth/callback`
- [ ] Deploy triggered and build succeeded
