import type { BrowserMetadata } from '../config/types';

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

export function createAnonymousEmail(metadata: BrowserMetadata): string {
  const fingerprintData = [
    metadata.userAgent,
    metadata.platform,
    metadata.language,
    metadata.screenResolution,
    metadata.timezone,
    metadata.cookiesEnabled,
    navigator.hardwareConcurrency || 'unknown',
    navigator.maxTouchPoints || 0,
    screen.colorDepth || 'unknown',
    new Date().getTimezoneOffset(),
  ].join('|');

  const fingerprint = btoa(fingerprintData)
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 40);

  return `anonymous_${fingerprint}@memox.local`;
}
