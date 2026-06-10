import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActionBus } from './action-bus';
import type { Action, ActionResult } from './types';

const okResult: ActionResult = { ok: true, components: [], message: null, checkout_url: null };
const errorResult: ActionResult = {
  ok: false, error: { code: 'SERVER_ERROR', message: 'Oops', recoverable: true },
};

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    message_id: 'msg_1', component_id: 'cmp_1',
    action_type: 'shopify.add_to_cart',
    payload: { variant_id: 'v1', quantity: 1 },
    ...overrides,
  };
}

describe('ActionBus.dispatch()', () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let bus: ReturnType<typeof createActionBus>;

  beforeEach(() => {
    fetchFn = vi.fn();
    bus = createActionBus({
      baseUrl: 'https://hub.example.com/api/v1/',
      authHeader: 'EmbedToken tok123',
      fetch: fetchFn as unknown as typeof fetch,
    });
  });

  it('POSTs to the correct URL with auth header', async () => {
    fetchFn.mockResolvedValue({ ok: true, json: async () => okResult });
    await bus.dispatch(makeAction());
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hub.example.com/api/v1/embed/components/action/');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('EmbedToken tok123');
    expect(JSON.parse(init.body as string)).toMatchObject({ action_type: 'shopify.add_to_cart' });
  });

  it('resolves with ok:true on success', async () => {
    fetchFn.mockResolvedValue({ ok: true, json: async () => okResult });
    const result = await bus.dispatch(makeAction());
    expect(result.ok).toBe(true);
  });

  it('resolves with ok:false when server returns an error body', async () => {
    fetchFn.mockResolvedValue({ ok: true, json: async () => errorResult });
    const result = await bus.dispatch(makeAction());
    expect(result.ok).toBe(false);
    expect(result.error?.recoverable).toBe(true);
  });

  it('returns a recoverable error when fetch throws (network error)', async () => {
    fetchFn.mockRejectedValue(new Error('Network failed'));
    const result = await bus.dispatch(makeAction());
    expect(result.ok).toBe(false);
    expect(result.error?.recoverable).toBe(true);
  });

  it('returns a recoverable error when HTTP status is 4xx', async () => {
    fetchFn.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const result = await bus.dispatch(makeAction());
    expect(result.ok).toBe(false);
    expect(result.error?.recoverable).toBe(true);
  });

  it('surfaces the server error envelope verbatim on non-2xx with a valid body', async () => {
    // Hub returns {ok:false, error:{...}} WITH HTTP error statuses (400/403/409/429).
    const serverEnvelope: ActionResult = {
      ok: false,
      error: { code: 'out_of_stock', message: 'Variant is out of stock.', recoverable: false },
    };
    fetchFn.mockResolvedValue({ ok: false, status: 409, json: async () => serverEnvelope });
    const result = await bus.dispatch(makeAction());
    expect(result).toEqual(serverEnvelope);
    expect(result.error?.code).toBe('out_of_stock');
    expect(result.error?.recoverable).toBe(false);
  });

  it('falls back to the generic recoverable error when a non-2xx body fails to parse', async () => {
    fetchFn.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('invalid json'); },
    });
    const result = await bus.dispatch(makeAction());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
    expect(result.error?.recoverable).toBe(true);
  });

  it('tracks pending state during inflight request', async () => {
    let resolve!: (v: unknown) => void;
    const deferred = new Promise((r) => { resolve = r; });
    fetchFn.mockReturnValue(deferred.then(() => ({ ok: true, json: async () => okResult })));
    const dispatchPromise = bus.dispatch(makeAction());
    expect(bus.isPending()).toBe(true);
    resolve(undefined);
    await dispatchPromise;
    expect(bus.isPending()).toBe(false);
  });

  it('remains pending while two concurrent dispatches are in flight and clears only when both settle', async () => {
    let resolveA!: (v: unknown) => void;
    let resolveB!: (v: unknown) => void;
    const deferredA = new Promise((r) => { resolveA = r; });
    const deferredB = new Promise((r) => { resolveB = r; });
    fetchFn
      .mockReturnValueOnce(deferredA.then(() => ({ ok: true, json: async () => okResult })))
      .mockReturnValueOnce(deferredB.then(() => ({ ok: true, json: async () => okResult })));

    const promiseA = bus.dispatch(makeAction());
    const promiseB = bus.dispatch(makeAction());
    expect(bus.isPending()).toBe(true);

    // Settle A first — B still in flight, so still pending
    resolveA(undefined);
    await promiseA;
    expect(bus.isPending()).toBe(true);

    // Settle B — both done, no longer pending
    resolveB(undefined);
    await promiseB;
    expect(bus.isPending()).toBe(false);
  });

  it('returns a recoverable network error when a 2xx response json() throws', async () => {
    fetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new Error('parse error'); },
    });
    const result = await bus.dispatch(makeAction());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
    expect(result.error?.recoverable).toBe(true);
  });
});
