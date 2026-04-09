'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { isPosthogConfigured, posthogApiHost, posthogKey } from '@/lib/posthog-config';
import { useAuth } from '@/components/AuthProvider';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isPosthogConfigured()) return;
    const url = `${window.location.origin}${pathname ?? ''}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

function PostHogAuthSync() {
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (!isPosthogConfigured()) return;
    if (authLoading) return;
    try {
      if (user?.id) {
        posthog.identify(user.id, {
          email: user.email,
          name: user.name,
        });
      } else {
        posthog.reset();
      }
    } catch {
      /* init race or blocked storage */
    }
  }, [user, authLoading]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const didInit = useRef(false);

  useEffect(() => {
    if (!isPosthogConfigured() || didInit.current) return;
    didInit.current = true;
    posthog.init(posthogKey(), {
      api_host: posthogApiHost(),
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogAuthSync />
      {children}
    </PHProvider>
  );
}
