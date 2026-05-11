// Smart auto-open attractor.
//
// Fires the chat panel open exactly once per tab session, but only
// when ALL FOUR invariants hold:
//
//   1. ``time_seconds`` has elapsed since the widget mounted
//   2. ``scroll_percent`` has been reached on the page
//   3. The visitor has NOT already clicked the launcher manually
//   4. The ``mcx_auto_opened`` sessionStorage flag is absent
//
// Once it fires, the flag is set, the scroll listener is detached, and
// the timer can no longer trigger anything. The host wires this in by
// calling ``notifyManualOpen()`` from inside its launcher click handler
// — that's invariant #3.

import type { ChatEmbedConfig } from '../../config/types';
import type { AttractorHandle } from './types';

const STORAGE_KEY = 'mcx_auto_opened';
const DEFAULT_TIME_SECONDS = 30;
const DEFAULT_SCROLL_PERCENT = 50;

export interface SmartAutoOpenHandle extends AttractorHandle {
  notifyManualOpen: () => void;
}

export function mountSmartAutoOpen(
  config: ChatEmbedConfig,
  openChat: () => void,
  onAutoOpen?: () => void,
): SmartAutoOpenHandle {
  const cfg = config.launcher?.attractors?.smart_auto_open;
  if (!cfg || !cfg.enabled) return noopHandle();
  if (safeGetSessionFlag()) return noopHandle();

  const timeMs = (cfg.time_seconds ?? DEFAULT_TIME_SECONDS) * 1000;
  const scrollPct = cfg.scroll_percent ?? DEFAULT_SCROLL_PERCENT;

  let timeReached = false;
  let scrollReached = false;
  let userOpenedManually = false;
  let fired = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const onScroll = (): void => {
    if (getScrollPct() >= scrollPct) {
      scrollReached = true;
      tryFire();
    }
  };

  function tryFire(): void {
    if (fired) return;
    if (!timeReached || !scrollReached) return;
    if (userOpenedManually) return;
    if (safeGetSessionFlag()) return;

    fired = true;
    safeSetSessionFlag();
    detachListeners();
    openChat();
    onAutoOpen?.();
  }

  function detachListeners(): void {
    window.removeEventListener('scroll', onScroll);
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  // Some pages don't scroll at all (single-screen landing pages). Treat
  // them as already past the scroll threshold so the time-only branch
  // can fire — otherwise the auto-open never triggers on these pages.
  if (!isPageScrollable() || getScrollPct() >= scrollPct) {
    scrollReached = true;
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  timerId = setTimeout(() => {
    timerId = null;
    timeReached = true;
    tryFire();
  }, timeMs);

  return {
    notifyManualOpen: () => {
      userOpenedManually = true;
      detachListeners();
    },
    cleanup: detachListeners,
  };
}

function noopHandle(): SmartAutoOpenHandle {
  return {
    notifyManualOpen: () => {},
    cleanup: () => {},
  };
}

function isPageScrollable(): boolean {
  const h = document.documentElement;
  return h.scrollHeight - h.clientHeight > 0;
}

function getScrollPct(): number {
  const h = document.documentElement;
  const scrollable = h.scrollHeight - h.clientHeight;
  if (scrollable <= 0) return 100;
  return Math.round((window.scrollY / scrollable) * 100);
}

function safeGetSessionFlag(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function safeSetSessionFlag(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore — private mode etc.
  }
}
