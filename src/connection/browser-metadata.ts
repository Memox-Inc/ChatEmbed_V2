import type { BrowserMetadata } from '../config/types';
import { getOrCreateDistinctId } from '../utils/distinct-id';

export function collectBrowserMetadata(): BrowserMetadata {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    referrer: document.referrer || 'direct',
    url: window.location.href,
    timestamp: new Date().toISOString(),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: navigator.cookieEnabled,
  };
}

export function createAnonymousEmail(): string {
  // MMX-895: key the anonymous visitor's synthetic email to the stable
  // per-BROWSER distinct_id (localStorage), NOT to a userAgent/device
  // fingerprint. The old fingerprint was identical for every visitor on the
  // same browser + OS + screen + timezone, so two different people collided on
  // one ``anonymous_<fp>@memox.local`` — the second one's POST /visitors/ then
  // violated unique(email, organization) → 500 → visitorless session → broken
  // bot. A per-browser id keeps a returning anonymous visitor stable (same id
  // reused, so their history stitches) while making distinct people distinct.
  const fingerprint = getOrCreateDistinctId()
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 40);

  return `anonymous_${fingerprint}@memox.local`;
}
