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

const DISTINCT_ID_KEY = 'mmx_chat_distinct_id';

export interface InitResponse {
  embed_id: string;
  config: Record<string, any>;
}

function getOrCreateDistinctId(): string {
  try {
    const existing = localStorage.getItem(DISTINCT_ID_KEY);
    if (existing) return existing;
    const id = `mmx-${'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })}`;
    localStorage.setItem(DISTINCT_ID_KEY, id);
    return id;
  } catch {
    return `mmx-fallback-${Date.now()}`;
  }
}

export async function fetchInitConfig(
  embedId: string | null,
  apiBase: string,
): Promise<Record<string, any>> {
  if (!embedId) return {};

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
      keepalive: true,
    });

    if (!resp.ok) throw new Error(`init failed: ${resp.status}`);
    const data: InitResponse = await resp.json();
    return data.config || {};
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Memox] init fetch failed, falling back to local config', e);
    return {};
  }
}
