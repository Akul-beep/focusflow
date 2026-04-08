'use client';

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import MobileTopBar from '@/components/MobileTopBar';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import MobileBottomNav from '@/components/MobileBottomNav';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import MorningBriefingOverlay from '@/components/MorningBriefingOverlay';
import { readThemePreference, resolveTheme } from '@/lib/theme';

const FeatureTourModal = dynamic(() => import('@/components/FeatureTourModal'), { ssr: false });

type DrawerCtx = {
  openMenu: () => void;
};

const MobileMenuContext = createContext<DrawerCtx | null>(null);

export function useMobileAppMenu() {
  return useContext(MobileMenuContext);
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isFocus = pathname.startsWith('/focus');
  const isLanding = pathname === '/' || pathname.startsWith('/landing');
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const minimalChrome = isFocus || isLanding || isAuth;

  useEffect(() => {
    const root = document.documentElement;
    if (isLanding) {
      root.setAttribute('data-landing', 'true');
      root.setAttribute('data-theme', 'light');
      return;
    }
    root.removeAttribute('data-landing');
    root.setAttribute('data-theme', resolveTheme(readThemePreference()));
  }, [isLanding, pathname]);

  const openMenu = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const ctx = useMemo(() => ({ openMenu }), [openMenu]);

  return (
    <MobileMenuContext.Provider value={minimalChrome ? null : ctx}>
      <div className="min-h-screen">
        {!minimalChrome && (
          <>
            <MobileTopBar onOpenMenu={openMenu} />
            <MobileNavDrawer open={drawerOpen} onClose={closeDrawer} />
          </>
        )}
        <div className={minimalChrome ? '' : 'pt-14 md:pt-0'}>{children}</div>
        {!minimalChrome && <SyncStatusIndicator />}
        {!minimalChrome && <MorningBriefingOverlay />}
        {!minimalChrome && <FeatureTourModal />}
        {!minimalChrome && <MobileBottomNav onOpenMenu={openMenu} />}
      </div>
    </MobileMenuContext.Provider>
  );
}
