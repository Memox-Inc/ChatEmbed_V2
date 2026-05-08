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
 *
 * Tolerant key reader: the dashboard form fields persist snake_case
 * keys (``primary_color``, ``header_bg_color``) into the JSON
 * ``theme_overrides`` column, while the embed's local config uses
 * camelCase (``primary``, ``headerBg``). Both arrive at this function
 * (boot path or live-update path), so accept either shape.
 */
import type { Theme } from '../config/types';

const STYLE_ID = 'mcx-theme-overrides';

function pick(theme: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = theme[k];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

export function applyTheme(
  root: ShadowRoot,
  theme: Theme | Record<string, unknown> | undefined | null,
): void {
  if (!theme) return;
  const t = theme as Record<string, unknown>;
  // Server (dashboard-saved) values are the SINGLE source of truth
  // when the operator has configured an embed. Once *any* snake_case
  // key is present, the entire theme block is treated as
  // server-driven and we ignore camelCase keys completely — even if
  // local config supplied them. This prevents stale local values
  // (e.g. a ``sendBtnHover`` that's purple) from leaking onto a
  // green launcher and producing a gradient mix.
  //
  // When no server keys are present at all (self-hosted / OSS
  // deployments without a Memox backend), fall through to the
  // camelCase local config so legacy embeds keep working.
  const hasServerKeys = (
    'primary_color' in t || 'header_bg_color' in t ||
    'send_btn_hover' in t || 'primary_hover' in t ||
    'header_text_color' in t
  );
  const primary = hasServerKeys
    ? pick(t, 'primary_color', 'primaryColor')
    : pick(t, 'primary');
  const hover = hasServerKeys
    ? pick(t, 'send_btn_hover', 'primary_hover') || primary
    : pick(t, 'sendBtnHover', 'primaryHover') || primary;
  const headerBg = hasServerKeys
    ? pick(t, 'header_bg_color', 'headerBgColor')
    : pick(t, 'headerBg', 'header_bg');
  const headerText = hasServerKeys
    ? pick(t, 'header_text_color', 'headerTextColor')
    : pick(t, 'headerText', 'header_text');
  if (!primary && !hover && !headerBg && !headerText) return;

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
