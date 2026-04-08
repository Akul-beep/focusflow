# Deploy Flowly to Vercel (GitHub)

## 1. Create the GitHub repo

1. On GitHub: **New repository** → name it e.g. **`flowly`** (or any name you like).
2. Push this Next.js app so the **repository root** is the folder that contains `package.json` (the `student-scheduler` app directory).

```bash
cd /path/to/student-scheduler   # folder with package.json named "flowly"
git add .
git commit -m "Flowly: ready for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/flowly.git
git push -u origin main
```

If the repo already exists and uses a **parent monorepo**, set **Root Directory** on Vercel to the subfolder that contains `package.json` (e.g. `student-scheduler`).

---

## 2. Create the Vercel project **flowly**

1. Go to **https://vercel.com** → sign in with **GitHub**.
2. **Add New…** → **Project** → **Import** your repo.
3. **Project name:** set to **`flowly`** (this controls the default URL: `https://flowly.vercel.app` if available).
4. **Root Directory:** `.` if `package.json` is at the repo root; otherwise pick the app subfolder.
5. **Framework:** Next.js (auto-detected). **Build:** `npm run build` (default).

---

## 3. Environment variables

In **Project → Settings → Environment Variables** (or during import), add:

| Name | Required | Notes |
|------|----------|--------|
| `GEMINI_API_KEY` | Yes* | From [Google AI Studio](https://aistudio.google.com/apikey). Server-side AI. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `GEMINI_MODEL` | No | e.g. `gemini-3.1-flash-lite-preview` — must match a model your key can call |
| `AI_USER_KEY_ENCRYPTION_SECRET` | Recommended | Random string **16+ characters** (not your Gemini key). Encrypts users’ saved BYOK keys. If omitted, the app can derive encryption from `GEMINI_API_KEY` instead. |
| `AI_SHARED_DAILY_LIMIT` | No | Default `5` — shared AI turns per signed-in user per day when using the server key |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical site URL, e.g. `https://flowly.vercel.app` — helps OG metadata |

\*If you only rely on per-user keys and skip server Gemini, you still need Supabase; server AI typically needs `GEMINI_API_KEY`.

Add for **Production** (and **Preview** if you want previews to work the same).

Do **not** commit `.env.local`.

---

## 4. Supabase auth redirect URLs

After the first deploy, copy your production URL (e.g. `https://flowly.vercel.app`).

1. **Supabase** → **Authentication** → **URL Configuration**.
2. **Site URL:** your production URL.
3. **Redirect URLs**, add:
   - `https://flowly.vercel.app/auth/callback` (use your real host)
   - `https://*.vercel.app/auth/callback` (optional, for preview deployments)

---

## 5. Deploy

Click **Deploy**. Fix any build errors from the Vercel log, then redeploy.

---

## 6. Custom domain (optional)

**Project → Settings → Domains** → add your domain and follow DNS steps.

---

## Quick checklist

- [ ] GitHub repo pushed; root matches Vercel **Root Directory**
- [ ] Vercel project named **flowly** (or your choice)
- [ ] `GEMINI_API_KEY`, Supabase URL + anon key set
- [ ] Optional: `AI_USER_KEY_ENCRYPTION_SECRET`, `NEXT_PUBLIC_SITE_URL`
- [ ] Supabase redirect URLs include `https://YOUR_HOST/auth/callback`
- [ ] Production deploy green

See also **`VERCEL_ENV_VARS.txt`** for a copy-paste-oriented list.
