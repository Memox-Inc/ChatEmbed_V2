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
        if (!resp.ok) return networkErrorResult(true);
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
