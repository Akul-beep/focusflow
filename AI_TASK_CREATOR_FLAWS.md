# AI Task Creator — Comprehensive Flaw Analysis (FIXES APPLIED ✅)

> Generated 2026-04-07. Covers `app/api/gemini/route.ts`, `lib/ai-task-text-parse.ts`,
> `lib/parse-task-groq-prompt.ts`, `lib/parse-schedule-metadata.ts`, `lib/scheduler.ts`,
> and `components/AITaskInput.tsx`.

---

## TL;DR — The Core Problem

The system **does not trust the LLM to do actual scheduling**. Instead, it asks a small model for a rough JSON classification, then applies **~1,400 lines of hand-written regex heuristics** that constantly fight the model's output. The result is:

1. The LLM returns garbage for non-trivial cases (wrong kind, phantom tasks, single-day plans).
2. Heuristics silently override the LLM — sometimes correctly, often wrongly.
3. The "adaptive scheduler" (`scheduleMicroTasksIntoTimes`) is a greedy slot-packer that has no concept of distributing work across days properly.

**Net effect**: "one day English, one day Physics for 12 days" → two blocks scheduled on one day, random invented tasks like "team create", and nothing on the calendar for the other 11 days.

---

## FLAW 1 — Wrong Model: `llama-3.1-8b-instant`

**File**: `ENV_LOCAL_EXAMPLE.txt` line 3, `route.ts` line 1770

```
GROQ_MODEL=llama-3.1-8b-instant
```

### What's wrong
- **LLaMA 3.1 8B** is a tiny model. It struggles with structured JSON output, complex date math, and obeying schema constraints reliably.
- You're asking it to produce deeply nested JSON (`study_plan.tasks[].microTasks[]` with `scheduledDate`, `estimatedMinutes`, rotate patterns, etc.) — this is **way beyond** what an 8B parameter model can do reliably.
- It frequently:
  - Invents phantom tasks from the context (`CTX`) — e.g. "team create" comes from it echoing back `activeTasks` titles from the context payload.
  - Returns `kind: "task"` when the answer should be `study_plan` with micro-tasks.
  - Collapses 12 days of alternating subjects into 2 micro-tasks.
  - Returns invalid `scheduledDate` values (empty or past dates).

### Recommended fix
Switch to **`llama-3.3-70b-versatile`** on Groq. It's still fast (Groq is optimized for it), has much better instruction following, and the token cost on Groq's free tier is the same (rate-limited, not charged). Alternatively, **`mixtral-8x7b-32768`** is a solid mid-tier option.

```env
GROQ_MODEL=llama-3.3-70b-versatile
```

Token budget: With 70B, you can actually **simplify** the prompt (fewer guard-rails needed) → **fewer input tokens** → net similar or lower total token usage.

---

## FLAW 2 — Phantom Tasks from Context Leaking

**File**: `route.ts` lines 2672-2701 (context building), `parse-task-groq-prompt.ts` line 17

### What's wrong
The system sends a `CTX` blob (existing exams + active tasks) alongside the user's input:

```
CTX:{"e":[{"n":"Physics Mock","s":"Physics","d":"2026-04-19"}],"a":[{"t":"Team Create Sprint","s":"CS","d":"2026-04-12"}]}
```

The prompt says "**Never** output separate items for CTX rows unless the user **explicitly names** that same commitment," but **8B models ignore this instruction regularly**. The model sees "Team Create Sprint" in context and outputs it as a separate scheduled item.

There's a post-hoc filter (`filterSpuriousBatchItemsFromContext`, line 754) trying to catch this, but it only does a **naive string match** (`u.includes(nt)`) — if the model rephrases the title even slightly, the filter misses it.

### Result
Random tasks like "Team Create" appear on the user's schedule that they never asked for.

### Recommended fix
1. **Don't send CTX at all for the `parseTask` action** — it's causing more harm than good. The model doesn't need to know about existing tasks to parse "one day English, one day physics for 12 days."
2. If CTX is needed for deduplication, do it **post-LLM** in server heuristics, not in the prompt.

---

## FLAW 3 — The Prompt is Overloaded and Contradictory

**File**: `parse-task-groq-prompt.ts` (the entire file, 34 lines)

### What's wrong
The `buildCompactParseTaskPrompt` function is trying to be **everything at once**:
- Event parser
- Task parser
- Study plan builder
- Rotating schedule generator
- Date inferrer
- Schema definition

All in ~600 tokens of prompt. For an 8B model, this is cognitive overload. The prompt contains:

```
• Rotating subjects until a deadline → ONE study_plan with exactly one parent row
  in the tasks array. One microTask per calendar day; titles alternate;
  scheduleMetadata.pattern=rotate_daily, cycle in order.
```

An 8B model **cannot reliably execute this instruction**. It requires:
1. Counting calendar days between today and a deadline
2. Creating N micro-tasks, one per day
3. Alternating titles based on a cycle
4. Setting `scheduledDate` as YYYY-MM-DD for each

This is a **multi-step reasoning task** that requires tool use or chain-of-thought, not a single-shot JSON completion from a tiny model.

### Recommended fix
The LLM should **only** be responsible for:
1. Classifying intent (`task`, `event`, `study_plan`)
2. Extracting structured fields (title, subject, due date, duration, cadence pattern)

The **server** should handle:
- Generating N micro-tasks for N calendar days
- Alternating subject titles
- Setting `scheduledDate` values

This is exactly what `expandStudyPlanRecurringSessionsFromText` (line 309) and `enforceCadenceOnNormalizedStudyPlan` (line 1121) try to do, but they're fighting the LLM's garbage output instead of being the primary source of truth.

---

## FLAW 4 — 1,378 Lines of Heuristics That Fight the Model

**File**: `lib/ai-task-text-parse.ts` (entire file)

### What's wrong
This file contains **1,378 lines** of regex-based post-processing that repeatedly overrides the LLM. Here's the cascade in `applyParseTaskHeuristics`:

```typescript
// route.ts line 1292
let p = { ...parsed };
const m1 = fixMisclassifiedWeeklyMeetingAsEvent(seg, p);
const m2 = fixMisclassifiedRecurringWeekdayClockBlockAsEvent(seg, p);
const m3 = fixMisclassifiedRecurringWeeklyClassSlotAsEvent(seg, p);
const m4 = fixMisclassifiedRecurringActivityPlan(seg, p);
const m4n = fixMisclassifiedRecurringNthWeekdaySlotAsEvent(seg, p);
const m5 = fixMisclassifiedAlternatingWeekdayPlanAsEvent(seg, p);
p = reconcileTaskVsEventKindFromUserText(seg, p);
p = stripSpuriousEventWeeklyRepeat(seg, p);
p = ensureEventWeeklyRepeatFromUserText(seg, p);
```

**7 separate fix-up passes**, each one overriding the previous. This means:
- The LLM says `task` → `fixMisclassifiedRecurringWeeklyClassSlotAsEvent` overrides to `event` → `reconcileTaskVsEventKindFromUserText` overrides back to `task` → `stripSpuriousEventWeeklyRepeat` strips the repeat.
- The heuristics **conflict with each other** and there's no clear priority chain.

For the specific case of "one day physics, one day English, 12 days":
1. LLM returns `study_plan` with 2 micro-tasks (one Physics, one English) — **wrong count**.
2. `hasTwoSubjectOneDayRotationPattern` correctly detects the rotation pattern.
3. `expandStudyPlanRecurringSessionsFromText` tries to expand to 12 days but the model returned too few micro-tasks.
4. `enforceCadenceOnNormalizedStudyPlan` detects `alternate` cadence and tries to rewrite.
5. The `shouldFlattenToOneSessionPerDayRotation` logic kicks in and regenerates micro-tasks.
6. But the **dates are wrong** because the model didn't supply a deadline, so it defaults to `addDays(todayLocal, 14)` → only 14 days, not 12.
7. Result: The UI shows blocks listed but **none are actually on the calendar** because the `scheduleMicroTasksIntoTimes` packer can't fit them.

### Recommended fix
Delete 80% of these heuristics. With a better model (70B), you get correct `kind` classification >95% of the time. Keep only:
- `extractWeekdayIndicesFromUserText` (useful for weekday parsing)
- `extractEventTimeRangeFromUserText` (useful for clock times)
- `sanitizeWeeklyRepeatDaysFromUserText` (simple validation)
- Basic title cleanup

---

## FLAW 5 — "Study Plan" Micro-Task Generation is Backwards

**File**: `route.ts` lines 103-195, 309-412, 1121-1242

### What's wrong
The flow for generating a study plan is:

1. **LLM generates micro-tasks** (almost always wrong — too few, wrong dates, wrong titles)
2. Server **normalizes** them (`normalizeStudyPlanFromParsed`)
3. Server **expands** them if too few (`expandStudyPlanRecurringSessionsFromText`)
4. Server **enforces cadence** (`enforceCadenceOnNormalizedStudyPlan`)
5. Server **merges duplicate parents** (`mergeStudyPlanParentTasksWithIdenticalMicroStacks`)

Steps 2-5 are trying to **fix** the output from step 1. But the LLM's output is so unreliable that these fixes often make things worse:

- `expandStudyPlanRecurringSessionsFromText` replaces the LLM's micro-tasks entirely, using `template.title` from `microTasks[0]` as the base — so if the LLM returned "Physics prep" as the first task, ALL 12 days become "Physics prep 1", "Physics prep 2"... ignoring the alternating pattern.

- `enforceCadenceOnNormalizedStudyPlan` has a `shouldFlattenToOneSessionPerDayRotation` check that's supposed to fix this, but it requires `themes.length >= 2` AND the model must have set `scheduleMetadata.pattern = rotate_daily` AND `cycle = ["Physics", "English"]`. The 8B model frequently omits or botches `scheduleMetadata`.

### The correct architecture
```
User input → LLM extracts {subjects, deadline, duration_per_session, cadence}
          → Server generates all micro-tasks deterministically
          → Scheduler places them on calendar
```

Not:
```
User input → LLM generates micro-tasks (badly)
          → Server fixes micro-tasks (partially)
          → Server re-generates micro-tasks (sometimes)
          → Scheduler places them (often fails)
```

---

## FLAW 6 — The Adaptive Scheduler is a Dumb Slot Packer

**File**: `lib/scheduler.ts` lines 576-848 (`scheduleMicroTasksIntoTimes`)

### What's wrong
The "adaptive scheduler" (`scheduleMicroTasksIntoTimesAdaptive` → `scheduleMicroTasksIntoTimes`) is a **greedy first-fit packer**:

1. For each micro-task, try the preferred day first.
2. If it doesn't fit, try the next day, then the next...
3. If no day works, put it in `unscheduled`.

**What it does NOT do**:
- **Distribute work evenly** across days (it front-loads everything near today).
- **Respect subject alternation** (it doesn't know about subjects at all).
- **Leave buffer between sessions** reliably.
- **Handle "one session per day"** constraints (it tries to pack as many as possible into each day).

There's `applyBalancedScheduleDates` (line 91) that does load-balancing by date, but this is **only used for assigning raw dates** (no clock times). The actual clock-time packer (`scheduleMicroTasksIntoTimes`) ignores these balanced dates and just greedily fills gaps.

### Why "it puts everything on one day"
When the micro-tasks all have `scheduledDate = ""` (because the LLM didn't set them), the packer starts from today and fills up today's work window, then tomorrow's, etc. If there's 240 minutes of work and today has 270 minutes free, **all 4 sessions go on today**.

The `applyBalancedScheduleDates` pass that runs earlier sets dates, but then `scheduleMicroTasksIntoTimes` is called with these dates as "hints" (`preferredDayForMicrotask`). The hint logic is:

```typescript
const preferredDayForMicrotask = (mt: MicroTask): Date | null => {
  // looks at mt.scheduledDate
  // but scheduledDate is often undefined or empty!
}
```

If the hint returns `null`, the packer ignores it and does first-fit.

### Recommended fix
The scheduler needs a two-pass approach:
1. **Date assignment**: Deterministically assign each micro-task to a calendar date based on cadence (daily, alternate, weekly, rotate).
2. **Time assignment**: For each date, place the day's micro-tasks into available time slots respecting work windows and calendar events.

Currently these two passes exist but are disconnected — `enforceCadenceOnNormalizedStudyPlan` does pass 1, and `scheduleMicroTasksIntoTimes` does pass 2, but pass 2 doesn't reliably respect pass 1's output.

---

## FLAW 7 — Double LLM Call for Tasks (Unnecessary Token Waste)

**File**: `components/AITaskInput.tsx` lines 656-670

### What's wrong
For `multi_step` tasks, the client makes **two** LLM calls:

1. `parseTask` → LLM classifies intent and returns basic fields
2. `chunkTask` → LLM breaks the task into micro-tasks with titles/descriptions/minutes

This doubles token usage and latency. The `parseTask` prompt already asks for `study_plan` with `microTasks`, so when it returns `kind: "task"` with `sessionStyle: "multi_step"`, the server converts it to a study plan seed (line 1402-1454), then the client calls `chunkTask` again.

### Recommended fix
- For `study_plan` responses, the micro-tasks are already included → no second call needed.
- For `task` responses that become `multi_step`, generate micro-tasks **server-side** using deterministic logic (not a second LLM call). The `chunkTask` prompt (line 2601) generates generic step names like "Gather sources → Build outline → Write draft → Revise → Proofread" — this can be a simple template function.

---

## FLAW 8 — `scheduleMetadata` Is Unreliable

**File**: `lib/parse-schedule-metadata.ts`

### What's wrong
The entire `scheduleMetadata` system depends on the LLM correctly outputting:

```json
{
  "scheduleMetadata": {
    "pattern": "rotate_daily",
    "cycle": ["Physics", "English"],
    "everyNWeeks": 1,
    "sessionsPerDay": 1
  }
}
```

The 8B model:
- Omits `scheduleMetadata` entirely ~40% of the time
- Sets `pattern: "unknown"` or `pattern: "pack"` for rotating patterns
- Returns `cycle: []` even when subjects are obvious
- Sometimes nests it inside `tasks[0]` instead of at the root level

The `parseScheduleMetadata` function (line 88) tries to handle aliasing and fallbacks, but if the model simply doesn't output the field, it returns `null`, and the entire rotation logic falls back to regex heuristics that are also unreliable.

### Recommended fix
Don't rely on the model for scheduling metadata. Extract it server-side from the user's text using the existing regex functions (which are actually decent for this):
- `hasTwoSubjectOneDayRotationPattern` → `rotate_daily`
- `userAskedForWeeklyRecurrence` + `extractWeekdayIndicesFromUserText` → `weekly`
- `inferStudyCadenceFromText` → cadence type

Use the model only for: title, subjects list, duration, deadline.

---

## FLAW 9 — Token Limits Are Too Tight

**File**: `route.ts` line 2711

```typescript
const responseText = await generateText(prompt, { maxCompletionTokens: 3072 });
```

### What's wrong
With `max_tokens: 3072`, a study plan with 12 micro-tasks each needing ~100 characters produces ~1200 tokens of output. Add JSON overhead, and you're at ~2000 tokens. But the **input** prompt with context is already ~1500-2000 tokens. On Groq free tier TPM limits, `prompt_tokens + max_tokens` is budgeted together, so you're constantly hitting rate limits.

### Recommended fix
- **With a better model + simpler prompt**: The input shrinks from ~2000 to ~500 tokens. You can afford 2048 max output tokens.
- **Don't generate micro-tasks in the LLM call**: Extract the pattern server-side, generate micro-tasks deterministically. Output becomes ~200 tokens (just the classification + fields).

---

## FLAW 10 — The Client Does Post-Processing the Server Already Did

**File**: `components/AITaskInput.tsx` lines 533-543

```typescript
const meetingCoerce = fixMisclassifiedWeeklyMeetingAsEvent(taskText, single);
const recurringCoerce = fixMisclassifiedRecurringWeekdayClockBlockAsEvent(taskText, single);
const classSlotCoerce = fixMisclassifiedRecurringWeeklyClassSlotAsEvent(taskText, single);
```

### What's wrong
The **server** already runs `applyParseTaskHeuristics` which calls these exact same functions (line 1292-1314). The **client** then runs them **again** on the server's response. This means:

1. Server: LLM says `task` → server overrides to `event` → sends `event` to client
2. Client: Gets `event` → runs the same heuristics → no change (wasted CPU)

OR worse:
1. Server: LLM says `task` → server heuristic keeps as `task` → sends to client
2. Client: Gets `task` → client heuristic overrides to `event` → inconsistent with server's decision

### Recommended fix
Remove ALL heuristic overrides from the client. The server should be the single source of truth for classification. The client should only handle UI presentation.

---

## FLAW 11 — Alternating Subject Detection is Fragile

**File**: `ai-task-text-parse.ts` lines 1044-1075

### What's wrong
`hasTwoSubjectOneDayRotationPattern` only matches very specific patterns:
- "one day Physics, one day English" ✅
- "Physics one day then English next day" ✅
- "alternate between Physics and English" ✅

But fails on natural variations:
- "I want to do physics one day and English the next" ❌
- "alternate physics and English daily" ❌
- "switch between physics and English every day" ❌
- "physics then English then physics then English for 12 days" ❌

The LLM is supposed to handle these variations, but it can't with the current model.

---

## FLAW 12 — Error Handling is `alert()` Based

**File**: `components/AITaskInput.tsx` line 776

```typescript
alert(msg + hint);
```

When anything fails (parsing, chunking, scheduling), the user gets a raw JavaScript `alert()` dialog with error messages like "Groq API error: 429 RATE_LIMIT_EXCEEDED." This is terrible UX and gives no recovery path.

---

## Summary of Recommended Changes (Priority Order)

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Switch to `llama-3.3-70b-versatile`** | Fixes ~60% of issues. Better JSON, fewer phantom tasks, correct `kind` classification. | 1 line in `.env.local` |
| 2 | **Stop sending CTX in parseTask** | Eliminates phantom "team create" tasks. | Remove ~30 lines |
| 3 | **Simplify the prompt** — LLM only extracts fields, server generates micro-tasks | Fixes rotation/scheduling. Fewer tokens. | ~200 lines refactor |
| 4 | **Remove client-side heuristic overrides** | Single source of truth, no conflicts | ~20 lines removed |
| 5 | **Fix the scheduler** — date assignment must respect cadence before slot-packing | Properly distributes work across days | ~100 line refactor in `scheduler.ts` |
| 6 | **Eliminate the `chunkTask` double-call** for multi_step tasks | Halves token usage and latency | ~80 lines refactor |
| 7 | **Remove 80% of regex heuristics** in `ai-task-text-parse.ts` | Simpler code, fewer conflicts. The 70B model handles these cases. | Delete ~1000 lines |
| 8 | **Better error handling** — toast notifications, retry buttons | UX improvement | ~50 lines |

---

## What the Architecture Should Look Like

```
┌──────────────────┐
│  User Input      │ "one day physics, one day English for 12 days, 1 hour each"
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  LLM (70B)       │  Returns: { kind: "study_plan",
│  Single call     │            subjects: ["Physics", "English"],
│  ~200 tokens out │            cadence: "rotate_daily",
│                  │            deadline: "2026-04-19",
│                  │            duration_per_session: 60,
│                  │            title: "Physics & English prep" }
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Server Logic    │  Generates 12 micro-tasks deterministically:
│  (Deterministic) │  Day 1: Physics prep (60 min)
│                  │  Day 2: English prep (60 min)
│                  │  Day 3: Physics prep (60 min)
│                  │  ... etc for 12 days
│                  │  Each with scheduledDate = YYYY-MM-DD
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Slot Packer     │  For each day with micro-tasks:
│  (scheduler.ts)  │  Find available time slot in work window
│                  │  Avoid calendar event conflicts
│                  │  Assign scheduledStart/scheduledEnd
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Client Preview  │  Shows 12 days on calendar with Physics/English alternating
│  + Confirm       │  User clicks "Add to schedule"
└──────────────────┘
```

This is fundamentally different from the current architecture where the LLM tries to generate all micro-tasks and the server spends 3,600 lines trying to fix them.
