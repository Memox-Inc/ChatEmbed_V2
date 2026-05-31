// Defense-in-depth sanitizer for server-supplied plain-text attractor strings
// (teaser text, persona name/message, pill text, welcome message).
//
// These fields are rendered via `.textContent` (never `innerHTML`) so they
// cannot inject HTML into the DOM on their own. However, a variant config
// from the Memox backend (or a malicious proxy) could carry stray markup.
// Running them through DOMPurify with ALL tags stripped ensures the value
// stored in memory and later assigned via textContent is clean plain text.
//
// Using ALLOWED_TAGS: [] and ALLOWED_ATTR: [] strips every HTML element and
// attribute — the output is always a plain-text string. This is the S5
// requirement from the MMX-562 spec.

import DOMPurify from 'dompurify';

/**
 * Strip ALL HTML tags from a server-supplied plain-text string.
 * Returns "" for null/undefined inputs.
 *
 * Safe to call in a non-browser context (SSR/test) — DOMPurify is a no-op
 * when window is unavailable, but jsdom provides a window in vitest.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (input == null) return '';
  try {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
  } catch {
    // Safety net: if DOMPurify is somehow unavailable at runtime, return
    // the raw value rather than throwing into the widget bootstrap path.
    return String(input);
  }
}
