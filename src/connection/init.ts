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
// A 5000ms abort timeout prevents a hanging server from blocking widget
// bootstrap indefinitely while leaving enough headroom for the CORS
// preflight round-trip. On timeout the TimeoutError is caught by the
// existing catch block which logs a warning and returns {}.
//
// Note: keepalive is intentionally omitted — it conflicts with AbortSignal
// in Chrome and Safari (browsers reject the combination), and keepalive is
// only meaningful for fire-and-forget beacon requests, not for a bootstrap
// fetch that we actively await.

import { getOrCreateDistinctId } from '../utils/distinct-id';
import type { ExperimentAssignment } from '../analytics/posthog';

export interface InitResponse {
  embed_id: string;
  config: Record<string, any>;
}

export type { ExperimentAssignment };

/** Abort the init fetch after this many milliseconds to unblock widget bootstrap.
 *  5000ms gives cross-origin POST (with CORS preflight) enough headroom — the
 *  OPTIONS round-trip + DNS + TLS + POST routinely takes 1-3s depending on
 *  network conditions. 1500ms was too tight and caused spurious AbortErrors. */
const INIT_TIMEOUT_MS = 5000;

export async function fetchInitConfig(
  embedId: string | null,
  apiBase: string,
  disableExperiments?: boolean,
): Promise<Record<string, any>> {
  if (!embedId) return {};

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Init fetch timed out', 'TimeoutError')),
    INIT_TIMEOUT_MS,
  );

  try {
    const base = apiBase.replace(/\/$/, '');
    // Build the init body conditionally: when disableExperiments is true, omit
    // distinct_id entirely (visitor is not bucketed into any A/B variant) and
    // send disable_experiments: true so the backend skips bandit resolution.
    const initBody: Record<string, unknown> = {
      embed_id: embedId,
      page_url: location.href,
      page_title: document.title,
    };
    if (disableExperiments) {
      initBody.disable_experiments = true;
    } else {
      initBody.distinct_id = getOrCreateDistinctId();
    }
    const resp = await fetch(`${base}/api/v1/embed/init/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initBody),
      signal: controller.signal,
    });

    if (!resp.ok) throw new Error(`init failed: ${resp.status}`);
    let data: any;
    try {
      data = await resp.json();
    } catch (parseError) {
      throw new Error(`init response was not valid JSON: ${parseError}`);
    }
    // Promote the top-level runtime fields onto the merged config so
    // the customer's HTML snippet only needs ``embedId`` — backend
    // URL, auth token, org_id, and agent_id all flow from the init
    // response. The branding payload (``data.config``) is run through
    // ``normalizeServerConfig`` exactly as before.
    const runtime: Record<string, any> = {};
    if (typeof data.token === 'string' && data.token) runtime.token = data.token;
    // Per-session embed token — preferred over the legacy global token.
    // Carries the embed config server-side, so REST calls under this auth
    // are org-scoped. See ChatEmbedConfig.sessionToken for details.
    if (typeof data.session_token === 'string' && data.session_token) {
      runtime.sessionToken = data.session_token;
    }
    if (typeof data.base_url === 'string' && data.base_url) runtime.baseUrl = data.base_url;
    if (typeof data.socket_url === 'string' && data.socket_url) runtime.socketUrl = data.socket_url;
    if (data.org_id !== undefined && data.org_id !== null) runtime.org_id = String(data.org_id);
    if (data.agent_id !== undefined && data.agent_id !== null) runtime.agent_id = String(data.agent_id);
    // Capture experiment assignments from the init response. The backend
    // returns an array of { experiment, variant, variant_label } objects
    // when the visitor has been bucketed. May be absent or empty on
    // backends that have not deployed the bandit yet.
    if (Array.isArray(data.experiments) && data.experiments.length > 0) {
      runtime.experiments = data.experiments as ExperimentAssignment[];
    }
    return { ...runtime, ...normalizeServerConfig(data.config || {}) };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Memox] init fetch failed, falling back to local config', e);
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}


/**
 * Convert ``snake_case`` to ``camelCase``.
 */
function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/**
 * Bridge the server's snake_case wire format onto the widget's
 * camelCase config keys so the boot AND live-update paths pick up
 * dashboard-saved settings without field-by-field mappings.
 *
 * Strategy:
 *   • Top-level keys are aliased to their camelCase equivalents
 *     (``welcome_message`` → ``welcomeMessage``, etc.). Both shapes
 *     are kept on the output so legacy code that still reads the
 *     snake_case key keeps working.
 *   • Nested objects are NOT recursively camelized — components like
 *     ``applyTheme`` already accept both shapes via tolerant key
 *     readers, and ``launcher`` / ``attractors`` are passed straight
 *     through to existing snake_case-aware mounters. Recursive
 *     conversion was rewriting the ``theme`` block and breaking
 *     ``applyTheme`` reads.
 *
 * Special-cased: ``lead_capture`` arrives as ``{enabled, mandatory}``
 * but the widget's ``leadCapture`` is a boolean. Extract ``enabled``
 * to ``leadCapture`` and keep the full object on ``leadCaptureConfig``
 * for callers that need ``mandatory``.
 */
export function normalizeServerConfig(serverConfig: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...serverConfig };

  for (const [k, v] of Object.entries(serverConfig)) {
    if (k.includes('_')) {
      const camel = snakeToCamelKey(k);
      // Don't clobber an existing camelCase value supplied by another
      // path (e.g. local config merged in earlier).
      if (!(camel in out)) out[camel] = v;
    }
  }

  if (serverConfig.lead_capture && typeof serverConfig.lead_capture === 'object') {
    out.leadCaptureConfig = serverConfig.lead_capture;
    out.leadCapture = !!serverConfig.lead_capture.enabled;
  }

  // Dashboard persists theme tokens in snake_case (``user_bubble``,
  // ``bot_avatar_svg_color``, etc.) into the JSON column, but every
  // widget UI component reads them in camelCase (``theme.userBubble``).
  // ``applyTheme`` accepts both via its tolerant ``pick()``, but the
  // inline reads in message-bubble / index.ts don't. Camelize the
  // ``theme`` block while preserving the snake_case keys so applyTheme's
  // existing branch logic (``hasServerKeys``) keeps working — both
  // shapes live side-by-side on the same object.
  if (serverConfig.theme && typeof serverConfig.theme === 'object' && !Array.isArray(serverConfig.theme)) {
    out.theme = camelizeTopLevel(serverConfig.theme as Record<string, any>);
  }
  return out;
}

/**
 * Add camelCase aliases for snake_case keys on a single-level object
 * without mutating the original. Used to bridge the dashboard's
 * snake_case ``theme_overrides`` JSON to the widget's camelCase reads.
 */
function camelizeTopLevel(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...obj };
  for (const [k, v] of Object.entries(obj)) {
    if (k.includes('_')) {
      const camel = snakeToCamelKey(k);
      if (!(camel in out)) out[camel] = v;
    }
  }
  return out;
}
