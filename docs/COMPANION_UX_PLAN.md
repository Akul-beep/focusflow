# FocusFlow — Companion UX plan (post-MVP)

## North star

One mental model: **the app handles planning, buffers, and recovery; the student executes.** Friction should drop at every handoff: syllabus → schedule, notes → study blocks, life events → replan.

## Design principles

1. **Defaults over decisions** — Never ask for numbers the app can infer (e.g. daily hours) from Settings (work window, session length).
2. **Batch where humans think in batches** — Syllabi are multi-subject; one paste/upload, then dates + order, then one confirm.
3. **Same language everywhere** — “Catch up”, “Replan”, “Add to schedule” use consistent verbs and surfaces.
4. **Progressive depth** — Happy path is short; power (reorder units, edit subjects) is one tap away, not step zero.
5. **Honest feasibility** — If the plan is tight, say so and suggest what to change (fewer units, earlier start, lighter other subjects).

## Phase map (executed vs next)

| Phase | Scope | Status |
|------|--------|--------|
| **P0** | Written plan (this doc) | Done |
| **P1** | Unified **multi-subject exam** flow: paste syllabus → AI split by subject → exam dates only → **syllabus order only** + manual ↑↓ to adjust → one AI plan with buffers + feasibility → commit all | **Implementing now** |
| **P2** | **Recovery companion** entry on Today + optional note sent to replan AI; same drawer pattern | **Implementing now** (lightweight) |
| **P3** | **Notes**: quick capture row, calmer visual hierarchy, **Schedule from note** → creates task + time-block | **Implementing now** |
| **P4** | Shared `PageHeader` / section rhythm across Dashboard, Today, Notes, Exams | Later |
| **P5** | True **cross-link graph** (note ↔ micro-task ↔ calendar event IDs); smart conflicts | Later |
| **P6** | **Command palette** / global “What should I do?” | Later |
| **P7** | Deeper **multi-week recovery** (not just this week) + narrative (“sick 5 days”) | Later |

## P1 — Multi-subject exam (detailed flow)

### Screen A — Syllabus in

- Large paste area + optional file upload (append text).
- Single primary CTA: **“Understand my syllabus”** (AI parses into subjects + units).
- Secondary: clear, “Paste a different syllabus”.

### Screen B — Exams + order

- Table/cards per subject (name editable):
  - **Exam date** (required per row).
  - **Unit order**: *As in syllabus* | *Reverse* | *Hardest first* (AI reorder before planning).
  - Expand: **unit list** with ↑ / ↓ to override order manually.
- No “hours per day” control; copy explains: *We use your work hours from Settings.*

### Screen C — One review

- Feasibility banner (green / amber) + short AI `adjustmentAdvice` if tight.
- Per-subject preview (collapsible).
- **“Add everything to my schedule”** → creates one **Exam** + one **Prep task** per subject with linked `examId` and microtasks (existing data model).

### AI contracts

- `syllabusBulkStructure` — raw text → `{ subjects: { name, units[] }[] }`.
- `multiExamPlan` — structured subjects + dates + order modes → `{ feasible, adjustmentAdvice, plans: { subject, plan[] }[], summary }`.

## P2 — Recovery companion

- Always-visible, low-anxiety entry on **Today**: e.g. **“Something came up?”**
- Opens existing recovery drawer; optional **short note** (“Sick Mon–Wed”, “Trip”) passed into `rebuildWeek` as context for the model.
- Keeps skip-based banner for passive detection; companion is **proactive**.

## P3 — Notes

- **Quick capture**: subject chips + “New note” inline (skip modal when possible).
- **Editor**: subtitle “Tied to *Subject* — schedule study when you’re ready” + **Schedule study** → duration + date → `addTask` + `scheduleMicroTasksIntoTimes` (existing scheduler).

## Success metrics (qualitative)

- Exam setup feels like **one story** (“dump syllabus → dates → done”), not three features.
- Student can explain the app in **one sentence**: “It turns my syllabus and notes into a realistic plan and fixes the plan when life happens.”
