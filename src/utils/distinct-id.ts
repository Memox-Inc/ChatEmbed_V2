// Shared visitor identity helper used by both fetchInitConfig (connection/init)
// and PostHog analytics (analytics/posthog).
//
// WHY THE KEY IS NOT NAMESPACED PER-WIDGET:
//   Visitor identity (distinct_id) is a per-browser property, not per-widget.
//   Two widgets on the same page should share the same distinct_id so PostHog
//   can stitch sessions correctly. Namespacing with sessionStore's embed-id
//   prefix would fragment the same visitor into multiple PostHog persons.
//   Additionally, fetchInitConfig runs BEFORE sessionStore.setNamespace() in
//   src/index.ts — reordering that call to enable namespaced keys risks
//   regressing the existing config-fetch flow.

const DISTINCT_ID_KEY = 'mmx_chat_distinct_id';

function generateId(): string {
  // Prefer crypto.randomUUID() (available in all modern browsers + HTTPS contexts)
  // for a cryptographically random UUID. Fall back to the Math.random template
  // used in the original implementation for older / non-secure contexts.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `mmx-${crypto.randomUUID()}`;
  }
  return `mmx-${'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  })}`;
}

export function getOrCreateDistinctId(): string {
  try {
    const existing = localStorage.getItem(DISTINCT_ID_KEY);
    if (existing) return existing;
    const id = generateId();
    localStorage.setItem(DISTINCT_ID_KEY, id);
    return id;
  } catch {
    return `mmx-fallback-${Date.now()}`;
  }
}
