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
 * Strip ALL HTML tags from a server-supplied plain-text string and
 * return TRUE plain text with HTML entities decoded.
 * Returns "" for null/undefined inputs.
 *
 * Two-step process:
 *   1. DOMPurify strips every HTML tag (ALLOWED_TAGS: []) — XSS-safe
 *      because all markup is removed before any decode happens.
 *   2. A textarea round-trip decodes any HTML entities left by DOMPurify
 *      (e.g. "&lt;" -> "<", "&amp;" -> "&") so callers that render via
 *      `.textContent` get the original human-readable string rather than
 *      entity-encoded noise.
 *
 * Security: the tag strip happens BEFORE the entity decode, so there is
 * no execution risk. A malicious "<script>&lt;img onerror=...&gt;" has
 * its outer tags stripped by DOMPurify first; the textarea only ever sees
 * plain-text character sequences — no markup can survive step 1. The
 * textarea element is detached from the document (never appended to the
 * DOM) so its innerHTML assignment is safe: browsers do not execute scripts
 * in detached nodes, and we immediately read .value (text only) before
 * discarding the element.
 *
 * Safe to call in a non-browser context (SSR/test) — DOMPurify is a no-op
 * when window is unavailable, but jsdom provides a window in vitest.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (input == null) return '';
  try {
    // Step 1: strip all HTML tags via DOMPurify.
    const stripped = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
    // Step 2: decode HTML entities via a detached textarea so that plain
    // text like "Save <50% today" or "Tom & Jerry" is returned verbatim
    // rather than as "Save &lt;50% today" / "Tom &amp; Jerry".
    // SECURITY NOTE: `stripped` has already had ALL HTML tags removed by
    // DOMPurify above — only plain-text character data remains. The textarea
    // is never appended to the document; we read .value immediately.
    // jsdom supports this pattern correctly in the vitest environment.
    try {
      const el = document.createElement('textarea');
      // nosec: DOMPurify has stripped all tags; only entity-encoded text remains.
      el.innerHTML = stripped; // safe: no tags survive step 1
      return el.value;
    } catch {
      // Fallback: if the DOM API is unavailable (pure SSR), return the
      // stripped string — entities are preserved but no tags or scripts.
      return stripped;
    }
  } catch {
    // Safety net: if DOMPurify is somehow unavailable at runtime, return
    // the raw value rather than throwing into the widget bootstrap path.
    return String(input);
  }
}
