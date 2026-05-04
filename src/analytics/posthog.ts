// PostHog analytics — TypeScript port of the V1 __mmxAnalytics IIFE.
//
// Module-level singleton: init() is called once during widget bootstrap,
// capture() is called from event sites. Both are no-ops when no apiKey
// has been configured, so the widget works fine for self-hosted / OSS
// users who haven't wired up PostHog.

const DEFAULT_HOST = 'https://us.i.posthog.com';
const DISTINCT_ID_KEY = 'mmx_chat_distinct_id';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export interface PostHogInitOptions {
  apiKey: string | null | undefined;
  host?: string;
  orgId?: string | number | null;
  agentId?: string | null;
  // Set when an attractor variant is active (e.g. 'pill', 'teaser',
  // 'persona'). Tagged onto every captured event so we can split funnel
  // metrics by variant.
  attractorVariant?: string | null;
}

interface State {
  apiKey: string | null;
  host: string;
  orgId: string | number | null;
  agentId: string | null;
  distinctId: string | null;
  utmProps: Record<string, string>;
  attractorVariant: string | null;
}

const state: State = {
  apiKey: null,
  host: DEFAULT_HOST,
  orgId: null,
  agentId: null,
  distinctId: null,
  utmProps: {},
  attractorVariant: null,
};

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

export function init(opts: PostHogInitOptions): void {
  state.apiKey = opts.apiKey || null;
  state.host = opts.host || DEFAULT_HOST;
  state.orgId = opts.orgId ?? null;
  state.agentId = opts.agentId ?? null;
  state.attractorVariant = opts.attractorVariant ?? null;
  state.distinctId = getOrCreateDistinctId();
  state.utmProps = readUtmFromUrl();
}

export function capture(eventName: string, additionalProps?: Record<string, unknown>): void {
  if (!state.apiKey) return; // not configured → no-op

  try {
    const props: Record<string, unknown> = {
      org_id: state.orgId,
      agent_id: state.agentId,
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer || null,
    };
    if (state.attractorVariant) props.attractor_variant = state.attractorVariant;
    Object.assign(props, state.utmProps);
    if (additionalProps) Object.assign(props, additionalProps);

    const body = JSON.stringify({
      api_key: state.apiKey,
      event: eventName,
      distinct_id: state.distinctId,
      properties: props,
      timestamp: new Date().toISOString(),
    });

    const url = `${state.host.replace(/\/$/, '')}/capture/`;
    // keepalive lets the request survive page unload — important for the
    // chat_widget_loaded event that may fire just before the user navigates
    // away. no-cors keeps the browser quiet about CORS preflights since
    // PostHog's capture endpoint accepts the api_key in the body.
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      mode: 'no-cors',
    }).catch(() => {
      // swallow — analytics must never break the widget
    });
  } catch {
    // swallow — analytics must never break the widget
  }
}

// Test-only helper. Resets module-level state so vitest can run multiple
// init/capture sequences in the same process. Not exported through any
// public barrel; safe to call from tests via direct import.
export function __resetForTesting(): void {
  state.apiKey = null;
  state.host = DEFAULT_HOST;
  state.orgId = null;
  state.agentId = null;
  state.distinctId = null;
  state.utmProps = {};
  state.attractorVariant = null;
}
