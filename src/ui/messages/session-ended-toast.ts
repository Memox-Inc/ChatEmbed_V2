/**
 * Session-ended toast — shown when the chat session expires server-side.
 *
 * Replaces the plain red error banner with a friendlier UX:
 *   - Two-line message ("This chat ended" + countdown).
 *   - Visible countdown so the visitor isn't surprised by the wipe.
 *   - "Start now" button so they can skip the wait.
 *
 * Returns the DOM element plus a ``dispose`` callback that clears the
 * countdown timer (call before unmounting to avoid leaks).
 */

export interface SessionEndedToastHandle {
  element: HTMLDivElement;
  dispose: () => void;
}

export function createSessionEndedToast(
  durationSec: number,
  onAdvance: () => void,
): SessionEndedToastHandle {
  const wrap = document.createElement('div');
  // Keep the legacy ``mcx-sys-notification-wrap`` class so existing tests
  // that target this selector continue to find the banner.
  wrap.className = 'mcx-sys-notification-wrap mcx-session-ended-wrap';

  const card = document.createElement('div');
  card.className = 'mcx-sys-notification mcx-sys-notification--closed mcx-session-ended';

  const title = document.createElement('div');
  title.className = 'mcx-session-ended-title';
  title.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>This chat ended</span>`;

  const subtitle = document.createElement('div');
  subtitle.className = 'mcx-session-ended-subtitle';
  const countdownEl = document.createElement('span');
  countdownEl.className = 'mcx-session-ended-countdown';
  countdownEl.textContent = String(durationSec);
  subtitle.append('Starting a new chat in ', countdownEl, '…');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mcx-session-ended-start';
  button.innerHTML = `Start now <span aria-hidden="true">→</span>`;

  card.append(title, subtitle, button);
  wrap.appendChild(card);

  let remaining = durationSec;
  let advanced = false;
  const advance = (): void => {
    if (advanced) return;
    advanced = true;
    if (intervalId !== null) clearInterval(intervalId);
    // Defer the callback so the click handler returns before the parent
    // tears down the DOM that contains the button.
    queueMicrotask(onAdvance);
  };

  button.addEventListener('click', advance);

  const intervalId: number | null = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      countdownEl.textContent = '0';
      advance();
      return;
    }
    countdownEl.textContent = String(remaining);
  }, 1000);

  return {
    element: wrap,
    dispose: () => {
      advanced = true;
      if (intervalId !== null) clearInterval(intervalId);
    },
  };
}
