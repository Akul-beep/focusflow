/** Client-side PostHog. Set in `.env.local` to enable analytics and in-app feedback capture. */
export function isPosthogConfigured(): boolean {
  return Boolean(typeof process !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}

export function posthogApiHost(): string {
  const h = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  return h || 'https://us.i.posthog.com';
}
