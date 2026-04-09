/** Client-side PostHog. Set in `.env.local` to enable analytics and in-app feedback capture. */
export function isPosthogConfigured(): boolean {
  return Boolean(
    typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_API_KEY?.trim())
  );
}

export function posthogKey(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_API_KEY?.trim() ||
    ''
  );
}

export function posthogApiHost(): string {
  const raw =
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_API_HOST?.trim() ||
    '';
  if (!raw) return 'https://us.i.posthog.com';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
