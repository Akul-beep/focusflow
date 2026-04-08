# PRD / design doc vs current product

Snapshot of **what the platform already does** vs **what design docs still call out**. Use this as a living checklist (not a promise of priority).

## Aligned or largely done

| Area | Doc reference | Status |
|------|----------------|--------|
| Focus + Pomodoro | `UX_DESIGN_PLAN`, `WIREFRAME_SCREENSHOT_GUIDE` | Focus page, timer, task/micro routing |
| Today / day agenda | UX plan “Today’s plan” | `TodayPage`, `getDayAgenda` |
| Tasks dashboard | UX Screen 3 | `DashboardPage`, filters, TaskCard |
| AI chunk + schedule | `FEATURES.md` | `/api/ai` task flows, Add Task |
| Calendar | FEATURES | Schedule-X, local TZ fixes |
| Exam planner | Recent work | `BulkExamPlanner`, syllabus groups |
| Recovery / replan | `PRODUCT_ROADMAP`, `COMPANION_UX_PLAN` | `rebuildWeek` + Today drawer; banner signals expanded |
| Auth + Supabase sync | `SYNC_IMPLEMENTATION.md` | Present in store + settings |
| Notes | App routes | Subject notes, editor |
| Analytics page | Route exists | `/analytics` |
| Motivation / streaks | Multiple docs | Store stats, DailyMotivation, messages |

## Gaps / polish (common PRD themes)

| Gap | Notes |
|-----|--------|
| **“Quick add” 10-second flow** | UX plan Screen 4: single-line add is partially there (Add Task modal) but not minimal one-field-only UX. |
| **Dashboard filters “Today / This week”** | Current: All / Active / Overdue / Completed — not “this week” slice. |
| **Notes → tasks** | `PRODUCT_ROADMAP`: checklist + “add as task” — not built. |
| **Multi-week recovery** | `COMPANION_UX_PLAN` P7: narrative replan beyond current week — only **this week** in `rebuildWeek`. |
| **Distraction blocker** | `DISTRACTION_BLOCKER_IMPLEMENTATION.md` — verify how much is wired vs placeholder. |
| **AI usage UI** | Settings has no “usage this month” / quota surfacing yet. |
| **Task marking consistency** | User deferred; no change tracked here. |

## Technical debt called out in repo

- `FEATURES.md` references `lib/gemini.ts` — some paths moved to `app/api/gemini/route.ts`.
- FullCalendar mentioned in FEATURES; calendar is Schedule-X now.

## Suggested next builds (product order)

1. **Notes to-dos → tasks** (roadmap).
2. **Quick-add** micro-flow on dashboard (optional due date, one field).
3. **Settings → AI**: link to provider console + optional local usage counter.
4. **Multi-week recovery** (new action + UI) when demand is clear.
