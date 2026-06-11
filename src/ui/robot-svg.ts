/**
 * Shared robot-face bot avatar SVG (head with two eyes + smile and a thin
 * antenna with a bead). Single source for the three render sites (message
 * bubble, lead-capture welcome bubble, thinking indicator) so the markup
 * ships once in the core bundle and the bot identity stays consistent
 * across every surface.
 *
 * @param size  width/height attribute value (e.g. '13', '20')
 * @param color stroke + fill color: a CSS color or 'currentColor' (callers
 *              that need theme overrides set element.style.color and pass
 *              'currentColor')
 */
export function robotSvg(size: string, color: string): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle class="antenna-ball" cx="12" cy="2.5" r="0.9" fill="${color}" stroke="none"/><path d="M12 3.4v2.1"/><circle class="cable-bead" cx="12" cy="4.45" r="0.45" fill="${color}" stroke="none"/><rect x="4" y="5.5" width="16" height="14" rx="4"/><circle class="eye-left" cx="9" cy="12" r="1.2" fill="${color}" stroke="none"/><circle class="eye-right" cx="15" cy="12" r="1.2" fill="${color}" stroke="none"/><path class="smile" d="M10.5 16q1.5 0.8 3 0" stroke-width="1.4" fill="none"/></svg>`;
}
