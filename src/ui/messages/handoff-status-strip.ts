/**
 * MMX-1373 — the "a human has been asked" status strip.
 *
 * When a visitor asks for a human the backend parks the chat on a rep and pages
 * them (MMX-1344). Until this existed the visitor saw nothing at all: a waiting
 * chat was indistinguishable from an ordinary AI conversation, which is how
 * leads were being lost.
 *
 * There is deliberately **no countdown and no spinner**. A parked chat only ends
 * when a rep claims it, or when it is closed after 7 days idle — and that idle
 * clock resets on the visitor's own messages, so an active visitor stays parked
 * indefinitely. Any ETA here would assert a deadline nothing enforces, which is
 * the exact class of false promise MMX-1344 removed. So the copy is a status:
 * it stays true for as long as it is shown.
 */

export const HANDOFF_STATUS_TEXT =
  "I've let the team know you'd like a human — I'll keep helping in the meantime.";

export function createHandoffStatusStrip(text: string = HANDOFF_STATUS_TEXT): HTMLDivElement {
  const strip = document.createElement('div');
  strip.className = 'mcx-handoff-status';
  // A status, not an alert: polite so screen readers announce it without
  // interrupting whatever the visitor is currently hearing.
  strip.setAttribute('role', 'status');
  strip.setAttribute('aria-live', 'polite');

  const icon = document.createElement('span');
  icon.className = 'mcx-handoff-status-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '💬'; // speech balloon, as used by system notifications
  strip.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'mcx-handoff-status-text';
  // textContent, never innerHTML — this string is static today, but the next
  // person to make it configurable should not inherit an injection point.
  label.textContent = text;
  strip.appendChild(label);

  return strip;
}
