# Scheduling architecture

This document is the **source of truth** for how FocusFlow-style scheduling is supposed to work—for **general productivity** (meetings, errands, work blocks) and **student / exam prep** (syllabus-driven revision, practice papers), including when they are **combined** on one calendar.

---

## 1. Two audiences, one calendar

| Audience | Typical inputs | What they care about |
|----------|----------------|----------------------|
| **General** | Meetings, calls, gym, deep-work holds, errands, project deadlines | Fixed events don’t move; tasks fit **around** them; due dates respected. |
| **Student** | Exams, syllabus topics, past papers, mocks, “2h Chemistry Friday” | Revision spread **before** each exam; practice sessions; **don’t lose** topics or blow past exam day. |
| **Combined** | Same person: job + school, or parent + student | Same rules: **events block time**, **tasks compete for remaining slots**, **exam-linked work gets first pick** among tasks. |

There is **one** underlying model. We do **not** fork the calendar into “student mode” vs “work mode” in the data layer; we use **priority, due dates, and tags** (`examId`, `source: exam-planner`) to bias packing.

---

## 2. Things you can put on the calendar

### A. **Calendar events** (meetings, classes, appointments)

- Live in **`calendarEvents`**.
- **Hard constraints** for scheduling: tasks are not placed on top of timed events (all-day events block the work window for that day).
- Good for: anything with a **fixed wall-clock time** or **recurring pattern** (weekly class).
- **AI path:** `parseTask` → `kind: "event"`.

### B. **Tasks** (commitments with a due date)

- Live in **`tasks`** with **`microTasks`** (one or more **schedulable units**).
- Each **micro-task** is what the **packer** places: it gets `scheduledDate` (preferred day), `scheduledStart`, `scheduledEnd` when possible.
- **AI path:** `parseTask` → `kind: "task"` with either:
  - **`sessionStyle: single_block`** — one sitting (e.g. one past paper), **no** sub-step breakdown.
  - **`sessionStyle: multi_step`** — AI **chunkTask** breaks work into ordered steps (essay, project, “prepare for test” with real phases).

### C. **Exam prep plans** (bulk syllabus → many dated blocks)

- **Bulk exam planner** creates tasks/microtasks with **`source: exam-planner`** and usually **`examId`**.
- Each microtask is **one subject-day block** (topics grouped for that day).
- **AI path:** `parseTask` → `kind: "study_plan"` for **many** sessions in one instruction; not for a single “2h paper tomorrow”.

### D. **Visual distinction on the calendar**

- **Timed** task blocks need **both** `scheduledStart` and `scheduledEnd` to show in **time lanes**.
- If only **`scheduledDate`** is known, the UI may show an **all-day “time TBD”** hint until repack assigns a slot.

---

## 3. When to use “AI breakdown” (multi-step) vs not

| User intent | Prefer | Why |
|-------------|--------|-----|
| “Finish essay by Friday” / “Science project” | **Multi-step** | Real work has phases (research → outline → draft → edit). |
| “2h math past paper tomorrow” / “Mock exam Saturday” | **Single block** or **calendar event (study)** | One continuous sitting; breakdown would be fake “review” steps. |
| “Math paper every day 2h until exam” | **Study plan** | Many dated sessions; model expands to concrete dates. |
| “Team standup Mon/Wed 9am” | **Event** | Fixed time + recurrence. |

**Rule of thumb:** breakdown is for **work that naturally decomposes**. Timed papers and mocks are **blocks**, not checklists.

---

## 4. Scheduling engine (how packing works)

**Entry points:** `rebalanceSchedule()` (store), `scheduleMicroTasksIntoTimes`, `scheduleMicroTasksIntoTimesAdaptive`, exam planner’s adaptive pack.

### 4.1 Inputs

- **Work window** (`workStart` / `workEnd` in Settings).
- **Busy intervals:** calendar events (including recurring weekly), plus **already placed** task blocks from other tasks during incremental packing.
- **Due date** per task: scheduling window is **from “today” (or `from`) through last valid prep day** (day before due when span ≥ 3 days—existing rule).

### 4.2 Preferences and fairness

- **`scheduledDate` on a microtask** = **preferred calendar day** (exam planner sets this). On **rebalance**, we **clear start/end** but **keep `scheduledDate`** so preferred days are tried first; if that day is full, the packer may use **another day still before the due date**—nothing is deleted, only **moved within the window**.
- **Exam-linked tasks first:** tasks with `source === 'exam-planner'` or non-empty `examId` are packed **before** other open tasks (then priority, then due date).
- **Soft daily cap** (pace-dependent): spreads load; can be exceeded when necessary via **adaptive widening** of the work window and **forced placement** so sessions are not dropped.

### 4.3 Adaptive behavior (`scheduleMicroTasksIntoTimesAdaptive`)

1. Normal pack with user’s work window.
2. If anything is unscheduled, **widen** window stepwise (similar to Reclaim-style flexibility).
3. If still unscheduled, **force-place** remaining items into valid days before the due date (may use **late evening** slots)—still **no overlap** with calendar events’ busy intervals.

### 4.4 What we guarantee vs not

| Guarantee | Notes |
|-----------|--------|
| No **removal** of topics or microtasks by the scheduler | Only **times** change. |
| No scheduling **after** task due (per existing last-day rules) | Exam = task due on exam day. |
| **Respect** calendar event busy time | Tasks don’t overlap timed blocks. |
| **Prefer** exam-planner days | May shift if physically impossible. |

**Not yet “perfect” (future):** explicit **user-locked days**, per-task **minimum focus guarantee**, **timezone travel**, external calendar **write-back**.

---

## 5. AI ↔ backend mapping

| User says (examples) | `parseTask` kind | App action |
|----------------------|------------------|------------|
| “Dentist 3pm Tuesday” | `event` | `addCalendarEvent` |
| “2h bio paper Friday” | `event` (study) or `task` + `single_block` | Calendar block or one placed block |
| “Essay due next Friday” | `task` + `multi_step` | `chunkTask` → pack |
| “Daily 2h papers until Math exam” | `study_plan` | Multiple tasks/microtasks with dates |

---

## 6. Implementation checklist (end-to-end)

**Done (baseline):**

- [x] Events block time; tasks pack around them.
- [x] Exam planner → preferred `scheduledDate`; preserved on rebalance.
- [x] Exam-linked tasks packed before other tasks.
- [x] Adaptive + forced placement to reduce “invisible on calendar.”
- [x] Single-block vs multi-step vs event vs study_plan in AI.

**Recommended next (Reclaim / power-user parity):**

- [x] **Settings:** “Re-run scheduling” (rebalance) + explanation of work window (`SettingsPage`).
- [ ] **Lock day** (optional flag on microtask): never move off preferred date; surface conflict in UI.
- [ ] **Conflict UI:** “Couldn’t fit X — widen window or move event.”
- [ ] **Focus / deep-work** event type that behaves like a soft event.

**Student-specific polish:**

- [ ] Link **exam dashboard** due dates to task due dates explicitly in copy.
- [ ] Optional **buffer day** before exam (no new heavy blocks).

---

## 7. File map (for contributors)

| Area | Files |
|------|--------|
| Core packer | `lib/scheduler.ts` (`scheduleMicroTasksIntoTimes`, `scheduleMicroTasksIntoTimesAdaptive`, `rebalanceAllTaskSchedules`) |
| Store rebalance | `lib/store.ts` → `rebalanceSchedule` |
| Exam bulk flow | `components/BulkExamPlanner.tsx`, `lib/exam-prep-schedule.ts` |
| AI parse | `app/api/gemini/route.ts` → `parseTask`, `chunkTask` |
| AI UI | `components/AITaskInput.tsx` |
| Calendar render | `components/ScheduleCalendar.tsx`, `components/pages/CalendarPage.tsx`, `lib/agenda.ts` |

This doc should be updated when behavior changes.
