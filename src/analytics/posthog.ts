// PostHog analytics for the embed (fire-and-forget).
//
// Ported from the legacy V1 widget. No SDK is bundled — events are POSTed
// to ``/capture/`` directly via ``fetch`` with ``keepalive: true`` so they
// survive page-unload. Failures never break the widget.
//
// Configure with ``posthogApiKey`` (required) and optionally ``posthogHost``
// (defaults to https://us.i.posthog.com). When ``posthogApiKey`` is unset
// every ``capture()`` call is a no-op.

const DISTINCT_ID_KEY = "mmx_chat_distinct_id";
const DEFAULT_HOST = "https://us.i.posthog.com";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

interface InitOptions {
  apiKey?: string | null;
  host?: string | null;
  orgId?: string | number | null;
  agentId?: string | null;
}

interface AnalyticsState {
  apiKey: string | null;
  host: string;
  orgId: string | number | null;
  agentId: string | null;
  distinctId: string;
  utmProps: Record<string, string>;
}

let state: AnalyticsState | null = null;

function readUtmFromUrl(): Record<string, string> {
  try {
    const params = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function getOrCreateDistinctId(): string {
  try {
    const existing = localStorage.getItem(DISTINCT_ID_KEY);
    if (existing) return existing;
    const id =
      "mmx-" +
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    localStorage.setItem(DISTINCT_ID_KEY, id);
    return id;
  } catch {
    return `mmx-fallback-${Date.now()}`;
  }
}

export function initAnalytics(opts: InitOptions): void {
  state = {
    apiKey: opts.apiKey || null,
    host: opts.host || DEFAULT_HOST,
    orgId: opts.orgId ?? null,
    agentId: opts.agentId ?? null,
    distinctId: getOrCreateDistinctId(),
    utmProps: readUtmFromUrl(),
  };
}

export function capture(eventName: string, additionalProps: Record<string, unknown> = {}): void {
  if (!state || !state.apiKey) return;
  try {
    const props: Record<string, unknown> = {
      org_id: state.orgId,
      agent_id: state.agentId,
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer || null,
      ...state.utmProps,
      ...additionalProps,
    };
    const body = JSON.stringify({
      api_key: state.apiKey,
      event: eventName,
      distinct_id: state.distinctId,
      properties: props,
      timestamp: new Date().toISOString(),
    });
    if (typeof window.fetch === "function") {
      void fetch(state.host.replace(/\/$/, "") + "/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        mode: "no-cors",
      }).catch(() => {
        /* swallow — analytics must never break the widget */
      });
    }
  } catch {
    /* silent — analytics must never break the widget */
  }
}
