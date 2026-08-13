/**
 * Operator-facing panel shown when ``/embed/init`` fails (MMX-1027).
 *
 * Rendered ONLY in inline mode — that is the dashboard's Live Interactive
 * Preview and the playground, i.e. surfaces where the person looking at it is
 * the one who can fix the configuration. On customer sites (floating mode) the
 * widget renders nothing instead, so end visitors never see Memox setup
 * guidance; the backend already logs the rejection for ops visibility.
 *
 * Styling is inline rather than shadow-scoped: this is a few lines of static
 * text, and inline declarations beat host-page selectors for the properties
 * that matter, so the message stays legible without pulling in the widget's
 * whole style pipeline.
 */

import type { EmbedInitFailureReason } from '../connection/init';
import { EmbedInitError } from '../connection/init';

export interface InitFailureCopy {
  title: string;
  detail: string;
}

/**
 * Map a failure reason onto copy that names the corrective action. Each reason
 * has a different fix, which is why they are distinguished at all — a generic
 * "something went wrong" would leave the operator exactly where the silent
 * fallback did.
 */
export function describeInitFailure(error: EmbedInitError): InitFailureCopy {
  const reason: EmbedInitFailureReason = error.reason;
  const origin = typeof location !== 'undefined' ? location.origin : 'this site';

  switch (reason) {
    case 'origin':
      return {
        title: 'Chat widget blocked on this site',
        detail:
          `${origin} is not listed in this embed's Allowed Origins. ` +
          `Add it under Allowed Origins in the agent's chat embed settings, then reload this page.`,
      };
    case 'not_found':
      return {
        title: 'Chat widget not found',
        detail:
          `This embed ID is invalid or has been deactivated. ` +
          `Check the embedId in your embed snippet against the agent's chat embed settings.`,
      };
    case 'timeout':
      return {
        title: 'Chat widget could not load',
        detail: `Couldn't reach the Memox server in time. Check your connection, then reload this page.`,
      };
    case 'network':
      return {
        title: 'Chat widget could not load',
        detail: `Couldn't reach the Memox server. Check your connection, then reload this page.`,
      };
    case 'bad_response':
      return {
        title: 'Chat widget could not load',
        detail: `The Memox server returned an unexpected response. Reload the page, and if it persists contact Memox support.`,
      };
    case 'http':
    default:
      return {
        title: 'Chat widget could not load',
        detail:
          `The Memox server returned an error` +
          `${error.status ? ` (HTTP ${error.status})` : ''}. ` +
          `Reload the page, and if it persists contact Memox support.`,
      };
  }
}

/**
 * Build and mount the error panel inside ``parent``. Returns the element so
 * callers (and tests) can inspect it.
 */
export function renderInitErrorPanel(parent: HTMLElement, error: EmbedInitError): HTMLElement {
  const { title, detail } = describeInitFailure(error);

  const panel = document.createElement('div');
  panel.className = 'mcx-embed-error';
  panel.setAttribute('role', 'alert');
  panel.style.cssText = [
    'box-sizing:border-box',
    'display:flex',
    'gap:10px',
    'align-items:flex-start',
    'margin:0',
    'padding:16px',
    'border:1px solid #f0c2c2',
    'border-radius:8px',
    'background:#fdf4f4',
    'color:#7f1d1d',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    'font-size:13px',
    'line-height:1.5',
    'text-align:left',
  ].join(';');

  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⚠';
  icon.style.cssText = 'flex:0 0 auto;font-size:15px;line-height:1.35';

  const body = document.createElement('div');
  body.style.cssText = 'flex:1 1 auto;min-width:0';

  const titleEl = document.createElement('div');
  titleEl.className = 'mcx-embed-error-title';
  titleEl.textContent = title;
  titleEl.style.cssText = 'font-weight:600;margin:0 0 4px';

  const detailEl = document.createElement('div');
  detailEl.className = 'mcx-embed-error-detail';
  detailEl.textContent = detail;
  detailEl.style.cssText = 'margin:0;overflow-wrap:anywhere';

  body.appendChild(titleEl);
  body.appendChild(detailEl);
  panel.appendChild(icon);
  panel.appendChild(body);
  parent.appendChild(panel);

  return panel;
}
