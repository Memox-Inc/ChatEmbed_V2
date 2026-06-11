/**
 * Suggestion pills (MMX-468). CORE module: NOT family-gated and tiny, so it
 * ships in chat-embed.js rather than the lazy components bundle. Extracted
 * from core/message-integration.ts so core does not import the (bundle-side)
 * integration module.
 *
 * textContent assignment keeps untrusted suggestion strings inert; no
 * innerHTML anywhere here.
 */

/**
 * Render suggestion pills below a message.
 * Uses the .mcx-qr pill class consistent with quick-questions.ts.
 */
export function renderSuggestionPills(
  suggestions: string[],
  onSelect: (s: string) => void,
): HTMLDivElement | null {
  if (!suggestions.length) return null;
  const container = document.createElement('div');
  container.className = 'mcx-suggestions';
  for (const s of suggestions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mcx-qr mcx-suggestion-pill';
    btn.textContent = s;
    btn.addEventListener('click', () => onSelect(s));
    container.appendChild(btn);
  }
  return container;
}
