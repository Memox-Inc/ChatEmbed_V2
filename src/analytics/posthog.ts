/**
 * attractor_variant taxonomy
 * --------------------------
 * Format: {form_factor}+{icon_type}[+tag...]
 *   - tags are ordered by _ATTRACTOR_TAGS precedence in variant_tagger.py:
 *     autoopen, badge, persona, pulse, teaser. Deterministic ordering matters
 *     for PostHog filters and dashboards.
 *
 * Example values:
 *   - "round+bubble"                          (bare default)
 *   - "round+bubble+pulse"                    (one attractor enabled)
 *   - "round+bubble+badge+pulse"              (two attractors in precedence order)
 *   - "round+photo+badge"                     (photo icon + badge)
 *   - "pill+custom+autoopen+persona"          (pill form factor, autoopen + persona in precedence order)
 *
 * Possible tokens:
 *   - form_factor: round | pill
 *   - icon_type:   bubble | custom | photo
 *   - tags:        autoopen | badge | persona | pulse | teaser
 *
 * Source of truth for tag derivation: memox_hub/embed_app/variant_tagger.py
 * (backend computes the variant and sends it via /api/v1/embed/init/).
 */

// PostHog analytics — TypeScript port of the V1 __mmxAnalytics IIFE.
//
// Module-level singleton: init() is called once during widget bootstrap,
// capture() is called from event sites. Both are no-ops when no apiKey
// has been configured, so the widget works fine for self-hosted / OSS
// users who haven't wired up PostHog.

import { getOrCreateDistinctId } from '../utils/distinct-id';

const DEFAULT_HOST = 'https://us.i.posthog.com';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
// Baseline variant string. When the server doesn't return an
// attractor_variant (older embed without launcher config, OSS deploy
// without a Memox backend), we still want every event tagged so funnel
// queries can split the baseline against experiment variants. Mirrors
// the variant tagger in memox-hub/embed_app/launcher_config.py.
const DEFAULT_ATTRACTOR_VARIANT = 'round+bubble';

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
  attractorVariant: DEFAULT_ATTRACTOR_VARIANT,
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

export function init(opts: PostHogInitOptions): void {
  state.apiKey = opts.apiKey || null;
  state.host = opts.host || DEFAULT_HOST;
  state.orgId = opts.orgId ?? null;
  state.agentId = opts.agentId ?? null;
  // Falsy (null/undefined/empty) → fall back to baseline so events are
  // never untagged.
  state.attractorVariant = opts.attractorVariant || DEFAULT_ATTRACTOR_VARIANT;
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
    props.attractor_variant = state.attractorVariant;
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
  state.attractorVariant = DEFAULT_ATTRACTOR_VARIANT;
}
