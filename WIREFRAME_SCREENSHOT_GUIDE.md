# Wireframe Screenshot Guide for Focus Flow

## Your Final Platform Location
**Path**: `/student-scheduler/`  
**Run**: `npm run dev` → `http://localhost:3000`

---

## Core Screens for Wireframes (Priority Order)

### 1. **Dashboard** (`/`) - Main Entry Point
**Why**: Primary landing page, shows overall task overview

**What to Capture**:
- Full screen view (1920x1080 or 1280x720)
- Left sidebar with navigation (Dashboard, Focus, Today, Calendar, Settings, Analytics)
- Header with "Dashboard" title
- Stats cards row (Active Tasks, Overdue - 2 cards in compact layout)
- Filter tabs (All, Active, Overdue, Completed)
- Task list with expanded tasks (showing micro-tasks and progress bars)
- Right sidebar (collapsed state) with collapse button visible
- At least 3-4 task cards visible

**Key Elements to Show**:
- Content-First layout (75% main, 25% sidebar)
- Task cards with priority indicators
- Progress bars on tasks
- Collapsible sidebar toggle button

---

### 2. **Focus Mode** (`/focus`) - Core Functionality
**Why**: Primary feature - Pomodoro timer for focused work

**What to Capture**:
- Full screen view
- Large circular timer in center (showing countdown)
- Current micro-task displayed below timer
- Control buttons (Start/Pause/Stop)
- "Next micro-task" preview section
- Back button to return to dashboard
- Timer should show active state (running with time remaining)

**Key Elements to Show**:
- Full-screen focus interface
- Prominent timer (240px diameter)
- Clear micro-task information
- Simple controls

**Optional States to Capture**:
- Break mode (if you want to show break screen)
- Task selection modal (when no task is selected)

---

### 3. **Today's Plan** (`/today`) - Daily Planning
**Why**: Shows daily agenda and scheduled micro-tasks

**What to Capture**:
- Full screen view
- Left sidebar
- Header with "Today" title and date
- Daily progress percentage/bar
- List of today's micro-tasks (at least 4-5 items)
- Each item showing: task title, micro-task title, estimated time, priority
- Quick start buttons for each task
- Right sidebar with widgets (if visible)

**Key Elements to Show**:
- Daily agenda structure
- Time-based organization
- Quick action buttons
- Progress visualization

---

### 4. **Calendar View** (`/calendar`) - Schedule Overview
**Why**: Shows calendar integration and scheduled tasks

**What to Capture**:
- Full screen view
- Left sidebar
- Calendar header with month/week/day view toggle
- Calendar grid showing events
- Color-coded tasks by priority
- At least 2-3 events visible on calendar
- Right sidebar (collapsed or expanded)

**Key Elements to Show**:
- Calendar grid layout
- Event color coding
- Multiple view options visible

---

### 5. **Add Task Modal** (Overlay on Dashboard)
**Why**: Shows task creation interface

**What to Capture**:
- Modal overlay on Dashboard
- Form fields visible:
  - Title input
  - Due date picker
  - Estimated time
  - Priority selector
  - Subject (optional)
- "Create Task" button
- Close button (X)

**Key Elements to Show**:
- Modal design
- Form layout
- Required vs optional fields

---

## Secondary Screens (Optional but Recommended)

### 6. **Settings** (`/settings`)
- Settings page layout
- Focus settings section
- Distraction blocker toggle
- Calendar integration options

### 7. **Analytics** (`/analytics`)
- Progress overview cards
- Charts/graphs
- Tree Forest visualization
- Streak tracking

---

## Screenshot Arrangement for Portfolio

### Recommended Layout Structure:

```
┌─────────────────────────────────────────────────────────┐
│  WIREFRAME SECTION                                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Dashboard Screenshot - Full Width]                     │
│  Caption: "Dashboard - Main entry point with task list" │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Focus Mode Screenshot - Full Width]                   │
│  Caption: "Focus Mode - Pomodoro timer interface"        │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Today's Plan Screenshot - Full Width]                 │
│  Caption: "Today's Plan - Daily agenda view"             │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Calendar View Screenshot - Full Width]                │
│  Caption: "Calendar - Schedule overview"                │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Add Task Modal Screenshot - Centered, Smaller]       │
│  Caption: "Task Creation Modal"                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Alternative: Side-by-Side Layout

```
┌──────────────────────────┬──────────────────────────┐
│  Dashboard               │  Focus Mode              │
│  [Screenshot]            │  [Screenshot]            │
├──────────────────────────┼──────────────────────────┤
│  Today's Plan            │  Calendar                │
│  [Screenshot]            │  [Screenshot]            │
└──────────────────────────┴──────────────────────────┘
```

---

## Screenshot Best Practices

### 1. **Browser Setup**
- Use Chrome or Firefox
- Set viewport to 1280x720 or 1920x1080
- Hide browser bookmarks bar
- Use full-screen mode (F11)

### 2. **Content Preparation**
- **Dashboard**: Have at least 5-6 tasks with different priorities
- **Focus Mode**: Start a timer session (or show ready state)
- **Today**: Ensure you have tasks scheduled for today
- **Calendar**: Have events visible in current month/week view

### 3. **Visual Consistency**
- Use same browser window size for all screenshots
- Keep sidebar in same state (expanded/collapsed)
- Use consistent zoom level (100%)
- Capture at same time of day for consistent lighting

### 4. **Screenshot Tools**
- **Mac**: Cmd + Shift + 4 (select area) or Cmd + Shift + 3 (full screen)
- **Windows**: Snipping Tool or Win + Shift + S
- **Browser Extensions**: Full Page Screen Capture (for full page)

### 5. **Post-Processing**
- Crop to remove browser chrome if needed
- Ensure consistent dimensions
- Add subtle borders if needed for portfolio
- Label each screenshot clearly

---

## Quick Checklist

Before taking screenshots, ensure:

- [ ] Dev server is running (`npm run dev`)
- [ ] Browser is at 100% zoom
- [ ] Browser window is properly sized (1280x720 or 1920x1080)
- [ ] You have sample data (tasks, events) in the app
- [ ] Sidebar state is consistent across screens
- [ ] No console errors visible
- [ ] All screens are accessible and functional

---

## Recommended Screenshot Sequence

1. **Start with Dashboard** - Set up your data here
2. **Capture Dashboard** - Full screen
3. **Open Add Task Modal** - Capture modal overlay
4. **Navigate to Focus Mode** - Start a session, capture active timer
5. **Navigate to Today** - Capture daily agenda
6. **Navigate to Calendar** - Switch to week view, capture calendar
7. **Optional**: Settings and Analytics if needed

---

## File Naming Convention

```
wireframe-dashboard.png
wireframe-focus-mode.png
wireframe-today-plan.png
wireframe-calendar.png
wireframe-add-task-modal.png
wireframe-settings.png (optional)
wireframe-analytics.png (optional)
```

---

## Portfolio Presentation Tips

1. **Add Annotations**: Use arrows and labels to highlight key features
2. **Show User Flow**: Number the screens to show navigation path
3. **Consistent Styling**: Use same border style, spacing, and captions
4. **Context**: Add brief descriptions explaining each screen's purpose
5. **Responsive Note**: Mention that wireframes show desktop view

---

## Key Features to Highlight in Wireframes

### Dashboard
- Content-First layout (75/25 split)
- Collapsible sidebar
- Expanded task view with progress bars
- Filter system

### Focus Mode
- Full-screen timer interface
- Auto-selected micro-task
- Simple controls
- Progress visualization

### Today's Plan
- Daily agenda structure
- Quick start buttons
- Progress tracking
- Time-based organization

### Calendar
- Multiple view options
- Color-coded events
- Integration with tasks

---

This guide ensures you capture all essential screens for a comprehensive wireframe presentation in your portfolio!
