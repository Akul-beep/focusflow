/** Lightweight shell while a code-split app route chunk loads (after storage is ready). */
export function AppRouteLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--surface-page)] text-sm text-[var(--text-muted)]"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent)]"
        aria-hidden
      />
      <span>Loading…</span>
    </div>
  );
}
