# Product roadmap

Living plan for friction, exam flow, and follow-on features.

## Recently improved

- **Exam / syllabus**: Default path is **one subject at a time**; **full syllabus** is labeled advanced. Clearer headings and Step 2 copy.
- **Structure**: `syllabusBulkStructure` can return **units/chapters with nested topics**; Step 2 shows a **grouped editor** (reorder chapters and lines) or **plain list** + **Format with AI** per subject.
- **Calendar / time**: Local dates and timezone on the calendar; modal z-index above week header.

## Next up (priority order)

### 1. Recovery mode

- **Shipped (baseline):** **Today** — “Something came up?” opens the recovery drawer; **Rebuild my week** calls `rebuildWeek` with preview → **Looks good** applies moves. Header banner when **≥2 skips today** *or* **≥2 overdue scheduled steps** *or* **1 skip + 1 overdue** (`lib/recovery-signals.ts`).
- **Shipped:** **Dashboard** card linking to `/today?recovery=1` when the same signals fire; URL auto-opens the drawer.
- **Later:** morning / evening nudge; **multi-week** replan (see `docs/PRD_GAP_STATUS.md`).

### 2. Notes → tasks (Microsoft To Do–style)

- Per note or global **checklist** (title + done + optional due date).
- **“Add as task”** on a line or selection: opens quick modal with **due date**, **subject**, link back to note.
- Lightweight **My list** view (could live under Notes or Today).

### 3. AI usage and limits

- **Groq default model** `llama-3.1-8b-instant`: documented **~14.4k requests/day (RPD)**, **30 RPM**, **6k TPM** (org-level; confirm in [Groq Limits](https://console.groq.com/settings/limits)). See **`docs/AI_PROVIDER_LIMITS.md`**.
- **Gemini:** quotas depend on your Google AI plan — check Google’s console.
- **Still to build:** Settings → AI usage counter + link to provider console; optional caching of identical syllabus parses.

### 4. Delight / retention (pick by impact)

- **Streak + exam countdown** on Today.
- **Smart suggestions**: “You have 20 min — next micro-task is …”
- **Weekly recap** (completed minutes, exams ahead).

## Exam flow principles

1. **Low friction first** — one subject, then optional bulk paste.
2. **Structure when possible** — chapters/units detected by AI, user reorders before scheduling.
3. **Escape hatches** — plain list + Format with AI when PDFs are ugly.

When implementing new AI steps, keep prompts **short and structured JSON** to control token use and failure modes.
