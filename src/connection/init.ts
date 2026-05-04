// Fetches launcher + attractor config from the embed init endpoint at
// widget bootstrap. The server returns the launcher block (form factor,
// attractor flags) plus an ``attractor_variant`` string that PostHog
// stamps on every event.
//
// Failures here MUST NOT block the widget — if the embedId is missing or
// the network is down, we fall through with an empty object and the
// caller merges it on top of the local defaultConfig. Worst case: the
// widget renders with the round/bubble defaults instead of the
// per-embed attractor variant.
//
// A 1500ms abort timeout prevents a hanging server from blocking widget
// bootstrap indefinitely. On timeout the AbortError is caught by the
// existing catch block which logs a warning and returns {}.
//
// Note: keepalive is intentionally omitted — it conflicts with AbortSignal
// in Chrome and Safari (browsers reject the combination), and keepalive is
// only meaningful for fire-and-forget beacon requests, not for a bootstrap
// fetch that we actively await.

import { getOrCreateDistinctId } from '../utils/distinct-id';

export interface InitResponse {
  embed_id: string;
  config: Record<string, any>;
}

/** Abort the init fetch after this many milliseconds to unblock widget bootstrap. */
const INIT_TIMEOUT_MS = 1500;

export async function fetchInitConfig(
  embedId: string | null,
  apiBase: string,
): Promise<Record<string, any>> {
  if (!embedId) return {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INIT_TIMEOUT_MS);

  try {
    const distinctId = getOrCreateDistinctId();
    const base = apiBase.replace(/\/$/, '');
    const resp = await fetch(`${base}/api/v1/embed/init/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embed_id: embedId,
        distinct_id: distinctId,
        page_url: location.href,
        page_title: document.title,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) throw new Error(`init failed: ${resp.status}`);
    const data: InitResponse = await resp.json();
    return data.config || {};
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Memox] init fetch failed, falling back to local config', e);
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}
