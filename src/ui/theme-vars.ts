/**
 * Shared theme-variable applier. Used at boot AND on live config
 * updates pushed via the embed WebSocket.
 *
 * The base widget stylesheet hardcodes ``--p`` (primary) and ``--ph``
 * (primary-hover) on ``:host`` for the launcher gradient, header
 * gradient, send button, focus rings, etc. Customer ``theme.primary``
 * config is unwired unless we explicitly inject overrides — this
 * module is the one place that does it.
 *
 * Calling ``applyTheme`` a second time with new values rewrites the
 * SAME ``<style>`` element rather than appending a new one, so it's
 * safe to invoke from a WS update handler.
 */
import type { Theme } from '../config/types';

const STYLE_ID = 'mcx-theme-overrides';

export function applyTheme(root: ShadowRoot, theme: Theme | undefined | null): void {
  if (!theme) return;
  if (!theme.primary && !theme.sendBtnHover && !theme.headerBg && !theme.headerText) {
    return;
  }
  const primary = theme.primary;
  const hover = theme.sendBtnHover || theme.primary;
  const headerBg = theme.headerBg;
  const headerText = theme.headerText;
  const lines: string[] = [];
  if (primary) lines.push(`--p: ${primary};`);
  if (hover) lines.push(`--ph: ${hover};`);

  let styleEl = root.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    root.appendChild(styleEl);
  }
  styleEl.textContent = `:host { ${lines.join(' ')} }
${headerBg ? `.mcx-header { background: ${headerBg} !important; }` : ''}
${headerText ? `.mcx-header, .mcx-header * { color: ${headerText} !important; }` : ''}`;
}
