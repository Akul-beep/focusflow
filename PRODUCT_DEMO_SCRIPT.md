# FocusFlow — 1-Minute Product Demo Script

Use this script while recording. Keep it under 60 seconds; speak clearly and move at a steady pace.

---

## Setup: Fill your calendar first (so scheduling “works around” things)

Do this **before** you add your main task. Your app schedules new task steps into **free time** within your **work window** (e.g. 4:00 PM–8:30 PM in Settings). Calendar events must fall **inside** that window or the scheduler won’t “work around” them — so the events below use 4:30pm–7:30pm.

**Order:** Do **Step A** (events), then **Step B** (main task). When you show the task, its steps will be scheduled in the gaps between these classes.

### Step A — Add calendar events (one prompt per line; click Create → Add / accept each)

Paste these into the **AI Task Creator** one at a time. Each creates a **calendar event** (not a task), so you’ll get “Added to Calendar.” and no preview steps.

Use times **inside your work window** (e.g. 4:00 PM–8:30 PM). Otherwise the scheduler only places task steps in that window and won’t “work around” events outside it.

1. **First event (blocks part of the window):**
   ```
   Math class Monday and Wednesday 5pm to 6pm
   ```
   Click **Create** → when it says it’s an event / “Added to Calendar”, accept it.

2. **Second event (another block in the window):**
   ```
   English class Tuesday 6:30pm to 7:30pm
   ```
   Click **Create** → accept.

3. **Optional third (more “busy” blocks):**
   ```
   Science class Wednesday 4:30pm to 5:30pm
   ```

After this, **Calendar** and **Today** will show these blocks. New tasks will be scheduled **around** them.

### Step B — Add the main task (breakdown + flexible scheduling)

Now add the task you’ll show in the demo. The scheduler will place its steps in the **gaps** between the classes above.

```
Math: three exercises from chapter 5 and revise quadratic equations for the test, due Wednesday
```

- Click **Create** → you’ll see the AI breakdown (several steps).
- In the preview, each step will have a **date** (and time if applicable) — those dates/times will avoid your Math/English/Science classes.
- Click **Add Task**.

When you record, you can say: *“I already had classes in my calendar — see how it scheduled the steps in the free slots instead of on top of them.”*

---

## Alternative: “Due in two days” wording

If you prefer to say “due in the next two days” on camera:

```
I have three math exercises and need to revise quadratic equations, due in two days
```

Same idea: do **Step A** first so the calendar has events, then add this task. Steps will land in the gaps.

---

## Other task prompts (if you want variety)

- **Short:** `Essay draft due next Friday, 800 words`
- **With subject:** `Biology lab report and review chapter 4, due Thursday`
- **Multiple parts:** `History reading pages 50–70 and short summary, due in 3 days`

Use these **after** you’ve added the calendar events (Step A) if you want to show flexible scheduling.

---

## AI task prompt (simple version — no setup)

If you skip calendar setup and just want one task for the demo:

```
Math homework chapter 5 due tomorrow, 3 exercises
```

Or:

```
Essay draft due next Friday, 800 words
```

---

## Demo flow (what to show + what to say)

### 1. Opening (5 sec)
**Screen:** Dashboard  
**Say:** *"This is FocusFlow — a student task and focus app."*

### 2. AI Task Creator (15 sec)
**Screen:** Sidebar visible (Dashboard)  
**Do:** If you did the setup above, your task is already there — point at it and at the step dates. Otherwise paste:  
`Math: three exercises from chapter 5 and revise quadratic equations for the test, due Wednesday`  
**Say:** *"I describe the task in plain English — due Wednesday."*  
**Do:** If adding live: Click **Create**. Wait for the preview (title, due date, steps with dates).  
**Say:** *"The AI breaks it into steps and schedules them in the free slots — it works around my classes."*  
**Do:** Click **Add Task** (if not already added).

### 3. Dashboard overview (10 sec)
**Screen:** Dashboard, task list and right column visible  
**Say:** *"On the dashboard I see my tasks, filters, completion bar, and FocusCoins. I can filter by All, Active, Overdue, or Completed."*  
**Do:** Briefly point at one task card (title, steps, progress) and at the Tree Forest / Daily Motivation on the right.

### 4. Start focus session (15 sec)
**Screen:** Dashboard → Focus  
**Do:** Click **Start Working** (or click **Focus** in the sidebar, then pick the task if needed).  
**Say:** *"I start a focus session. The timer runs for a short block; I see the current step and progress."*  
**Do:** Click **Start focus**. Let the timer run 2–3 seconds.  
**Say:** *"I earn FocusCoins as I work and can pause or stop anytime."*

### 5. Today & Calendar (8 sec)
**Screen:** Today page, then Calendar  
**Say:** *"Today shows what’s planned for this day; Calendar shows events and I can add classes or events."*  
**Do:** Click **Today** in sidebar, then **Calendar**. No need to click inside modals unless you want to.

### 6. Wrap-up (5 sec)
**Screen:** Back to Dashboard or Focus  
**Say:** *"That’s FocusFlow — AI task breakdown, scheduling, focus timer, and progress in one place for students."*

---

## Files to show in your video (for “code I wrote” part)

Show these in your editor during the demo (or in a short code segment):

| Purpose        | File path (from project root)                     | Lines  | When to show                          |
|----------------|----------------------------------------------------|--------|--------------------------------------|
| **Frontend — Dashboard** | `student-scheduler/components/pages/DashboardPage.tsx` | ~263  | When talking about dashboard UI      |
| **Backend — AI parsing** | `student-scheduler/app/api/gemini/route.ts`          | ~502  | When talking about AI task/event parsing |
| **Short file** | `student-scheduler/lib/agenda.ts`                   | ~110  | When you want a small, readable file  |

- **DashboardPage.tsx** — Main dashboard: header, stats, filters, task list, sidebar. Good to show you built the main UI.
- **app/api/gemini/route.ts** — Gemini API: parse task, chunk task, schedule task. Good to show backend AI logic.
- **lib/agenda.ts** — Builds “today’s agenda” from tasks and calendar. Short and easy to skim; good for a quick “this is my code” moment.

All three files have been cleaned of comments so they look like your own code.

---

## Quick checklist before recording

**If you want to show flexible scheduling (workarounds):**
- [ ] App running (`npm run dev`), no errors
- [ ] **Step A:** Add 2–3 calendar events (e.g. `Math class Monday and Wednesday 9am to 10am`, then `English class Tuesday 2pm to 3pm`) via AI Task Creator — accept each so they appear on Calendar
- [ ] **Step B:** Add main task: `Math: three exercises from chapter 5 and revise quadratic equations for the test, due Wednesday` — click Create → Add Task so the task and its step dates are already there
- [ ] Open **Calendar** or **Today** once to confirm events and task steps show with dates/times

**If you’re keeping it simple (no calendar setup):**
- [ ] Add one task, e.g. `Math homework chapter 5 due tomorrow, 3 exercises`

**Code / general:**
- [ ] Editor tabs open: `DashboardPage.tsx`, `app/api/gemini/route.ts`, `lib/agenda.ts`

Good luck with the demo.
