import type { Action, ActionResult, ErrorEnvelope } from './types';

export interface ActionBusOptions {
  baseUrl: string;
  authHeader: string;
  fetch?: typeof globalThis.fetch;
}

export interface ActionBus {
  dispatch(action: Action): Promise<ActionResult>;
  isPending(): boolean;
}

function networkErrorResult(recoverable = true): ActionResult {
  const env: ErrorEnvelope = {
    code: 'NETWORK_ERROR',
    message: 'Could not reach the server. Please try again.',
    recoverable,
  };
  return { ok: false, error: env };
}

/**
 * True when a parsed non-2xx body is the hub's error envelope
 * ({ok:false, error:{code,message,recoverable}}) and can be surfaced verbatim.
 */
function isServerErrorEnvelope(body: unknown): body is ActionResult {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as { ok?: unknown; error?: unknown };
  return candidate.ok === false
    && typeof candidate.error === 'object'
    && candidate.error !== null;
}

export function createActionBus(opts: ActionBusOptions): ActionBus {
  const _fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  let _pending = false;
  const url = `${opts.baseUrl.replace(/\/$/, '')}/embed/components/action/`;

  return {
    isPending() { return _pending; },

    async dispatch(action: Action): Promise<ActionResult> {
      _pending = true;
      try {
        let resp: Response;
        try {
          resp = await _fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: opts.authHeader },
            body: JSON.stringify(action),
          });
        } catch {
          return networkErrorResult(true);
        }
        if (!resp.ok) {
          // The hub returns its {ok:false, error:{...}} envelope WITH HTTP error
          // statuses (400 validation, 403 ownership, 409 stock, 429 rate limit).
          // Surface that envelope verbatim so renderers show the server's message
          // and honor its recoverable flag instead of a generic network error.
          try {
            const body: unknown = await resp.json();
            if (isServerErrorEnvelope(body)) return body;
          } catch {
            // fall through to the generic recoverable error
          }
          return networkErrorResult(true);
        }
        try {
          return (await resp.json()) as ActionResult;
        } catch {
          return networkErrorResult(true);
        }
      } finally {
        _pending = false;
      }
    },
  };
}
