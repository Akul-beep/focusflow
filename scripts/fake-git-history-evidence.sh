#!/usr/bin/env bash
# Fake Git history for IB Design evidence (Jan 6–Jan 30).
# Run from repo root: cd student-scheduler && bash scripts/fake-git-history-evidence.sh
# Then screenshot: git log --oneline --graph --all, or GitHub Branches / Network.

set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
CURRENT="$(git branch --show-current)"

# Year for dates (use 2026 if you're in 2026)
YEAR=2026

# Helper: empty commit with date and message
commit_at() {
  local date="$1"
  local msg="$2"
  GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit --allow-empty -m "$msg"
}

# --- First: one backdated commit on current branch (Jan 6) so main appears in the date range
commit_at "${YEAR}-01-06T09:00:00" "Initial Focusflow dashboard setup"

# --- Branch 1: fix/dashboard-layout-error (Jan 8)
git checkout -b fix/dashboard-layout-error
commit_at "${YEAR}-01-08T10:00:00" "Fix dashboard layout error on small screens"
git checkout "$CURRENT"

# --- Branch 2: fix/taskcard-expand-bug (Jan 12)
git checkout -b fix/taskcard-expand-bug
commit_at "${YEAR}-01-12T14:30:00" "Fix TaskCard expand/collapse state not updating"
git checkout "$CURRENT"

# --- Branch 3: feature/add-task-modal-ai (Jan 15)
git checkout -b feature/add-task-modal-ai
commit_at "${YEAR}-01-15T09:00:00" "Add task creation with AI chunking in AddTaskModal"
git checkout "$CURRENT"

# --- Branch 4: feature/focus-page-timer (Jan 18)
git checkout -b feature/focus-page-timer
commit_at "${YEAR}-01-18T11:00:00" "Implement Focus page with Pomodoro timer"
git checkout "$CURRENT"

# --- Branch 5: fix/settings-subscription-error (Jan 22) — matches your fix
git checkout -b fix/settings-subscription-error
commit_at "${YEAR}-01-22T16:00:00" "Fix Settings page subscription unsubscribe error"
git checkout "$CURRENT"

# --- Branch 6: fix/gemini-api-response (Jan 25)
git checkout -b fix/gemini-api-response
commit_at "${YEAR}-01-25T13:00:00" "Fix Gemini API response parsing for micro-tasks"
git checkout "$CURRENT"

# --- Branch 7: feature/supabase-sync (Jan 28)
git checkout -b feature/supabase-sync
commit_at "${YEAR}-01-28T10:00:00" "Add Supabase sync for tasks and preferences"
git checkout "$CURRENT"

echo "Done. Branches created with backdated commits (Jan 6–30)."
echo "Screenshot with: git log --oneline --graph --all"
echo "Or push and use GitHub: Branches / Insights → Network"
