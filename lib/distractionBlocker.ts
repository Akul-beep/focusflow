/**
 * Distraction Blocker Implementation
 * 
 * Note: Full site blocking requires a browser extension or service worker.
 * This implementation provides:
 * 1. Visual warnings when blocked sites are accessed
 * 2. Redirect functionality (limited by browser security)
 * 3. Focus mode detection
 * 
 * For production, implement as a browser extension:
 * - Chrome Extension with declarativeNetRequest API
 * - Firefox Extension with webRequest API
 * - Service Worker (limited to same origin)
 */

import { DistractionBlockSettings } from '@/types';

export function checkIfSiteShouldBeBlocked(
  url: string,
  settings: DistractionBlockSettings,
  isFocusMode: boolean
): boolean {
  if (!settings.enabled) return false;
  if (!isFocusMode && !settings.blockDuringFocus) return false;

  const hostname = new URL(url).hostname.replace('www.', '');
  
  return settings.blockedSites.some((blockedSite) => {
    const blockedHostname = blockedSite.replace('www.', '');
    return hostname === blockedHostname || hostname.endsWith(`.${blockedHostname}`);
  });
}

export function getBlockedSiteMessage(blockedSite: string): string {
  return `🚫 This site is blocked during focus sessions. Stay focused!`;
}

/**
 * Client-side blocking using page visibility and focus detection
 * This is a limited implementation - full blocking requires browser extension
 */
export function setupClientSideBlocking(
  settings: DistractionBlockSettings,
  isFocusMode: boolean,
  onBlocked: (site: string) => void
) {
  if (typeof window === 'undefined') return;

  // Check current page
  if (isFocusMode && settings.blockDuringFocus) {
    const currentHostname = window.location.hostname.replace('www.', '');
    const isBlocked = settings.blockedSites.some((site) => {
      const blockedHostname = site.replace('www.', '');
      return currentHostname === blockedHostname || currentHostname.endsWith(`.${blockedHostname}`);
    });

    if (isBlocked) {
      // Show blocking page
      showBlockingPage(settings.blockedSites.find((s) => 
        currentHostname.includes(s.replace('www.', ''))
      ) || 'this site');
      onBlocked(currentHostname);
    }
  }

  // Monitor for navigation attempts
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!isFocusMode || !settings.blockDuringFocus) return;
    
    // This can only show a warning, can't actually prevent navigation
    // Full blocking requires browser extension
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

function showBlockingPage(blockedSite: string) {
  if (typeof document === 'undefined') return;

  // Create blocking overlay
  const overlay = document.createElement('div');
  overlay.id = 'distraction-blocker-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #6A9BCC 0%, #788C5D 100%);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Poppins', Arial, sans-serif;
    color: white;
  `;

  overlay.innerHTML = `
    <div style="text-align: center; padding: 2rem; max-width: 500px;">
      <div style="font-size: 4rem; margin-bottom: 1rem;">🚫</div>
      <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 1rem;">
        Site Blocked
      </h1>
      <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">
        ${blockedSite} is blocked during focus sessions to help you stay focused.
      </p>
      <p style="font-size: 1rem; opacity: 0.8;">
        Return to your focus session to continue working.
      </p>
      <button 
        id="blocker-close-btn"
        style="
          margin-top: 2rem;
          padding: 0.75rem 2rem;
          background: white;
          color: #6A9BCC;
          border: none;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
        "
      >
        Go Back to Focus Mode
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Handle close button
  const closeBtn = overlay.querySelector('#blocker-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.remove();
      // Redirect to focus mode
      if (window.location.pathname !== '/focus') {
        window.location.href = '/focus';
      }
    });
  }
}

/**
 * Browser Extension Implementation Guide
 * 
 * For Chrome Extension (manifest.json):
 * {
 *   "manifest_version": 3,
 *   "name": "Student Scheduler Blocker",
 *   "permissions": ["declarativeNetRequest", "storage"],
 *   "declarative_net_request": {
 *     "rule_resources": [{
 *       "id": "ruleset",
 *       "enabled": true,
 *       "path": "rules.json"
 *     }]
 *   }
 * }
 * 
 * For Firefox Extension:
 * - Use webRequest API with onBeforeRequest listener
 * - Block requests to blocked domains
 */
