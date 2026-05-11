import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInitConfig } from './init';

describe('fetchInitConfig', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Failure paths intentionally console.warn — silence in tests so the
    // suite output stays clean without losing the warning in production.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches config from /embed/init with embedId', async () => {
    const mockResponse = {
      embed_id: 'emb_test123',
      config: {
        primary_color: '#8349ff',
        launcher: { form_factor: 'round', icon_type: 'bubble' },
        attractor_variant: 'round+bubble',
      },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

    const result = await fetchInitConfig('emb_test123', 'https://api.memox.io');
    expect(result.launcher.form_factor).toBe('round');
    expect(result.attractor_variant).toBe('round+bubble');
    expect(fetchMock.mock.calls[0][0]).toContain('/embed/init');
  });

  it('returns empty object if no embedId', async () => {
    const result = await fetchInitConfig(null, 'https://api.memox.io');
    expect(result).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to empty config on fetch error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const result = await fetchInitConfig('emb_test123', 'https://api.memox.io');
    expect(result).toEqual({});
  });

  it('falls back to empty config on non-2xx response', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const result = await fetchInitConfig('emb_test123', 'https://api.memox.io');
    expect(result).toEqual({});
  });

  it('persists distinct_id in localStorage and reuses it on subsequent calls', async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ embed_id: 'emb_test', config: {} }), { status: 200 }),
    );

    await fetchInitConfig('emb_test', 'https://api.memox.io');
    const firstId = localStorage.getItem('mmx_chat_distinct_id');
    expect(firstId).toBeTruthy();

    await fetchInitConfig('emb_test', 'https://api.memox.io');
    expect(localStorage.getItem('mmx_chat_distinct_id')).toBe(firstId);

    const body1 = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const body2 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body1.distinct_id).toBe(firstId);
    expect(body2.distinct_id).toBe(firstId);
  });

  it('strips trailing slash from apiBase', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ embed_id: 'emb', config: {} }), { status: 200 }),
    );
    await fetchInitConfig('emb', 'https://api.memox.io/');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.memox.io/api/v1/embed/init/');
  });

  it('aborts and returns {} when fetch hangs past INIT_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, opts: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
        // never resolves on its own
      }),
    ));

    const promise = fetchInitConfig('test-embed-id', 'https://api.example.com');
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result).toEqual({});

    vi.useRealTimers();
  });

  it('clears the timeout timer on successful fetch (no leaked timer)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, _opts: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ embed_id: 'emb', config: { foo: 'bar' } }), { status: 200 }),
      ),
    ));

    const result = await fetchInitConfig('emb', 'https://api.example.com');
    expect(result).toEqual({ foo: 'bar' });

    // Advance well past INIT_TIMEOUT_MS. If clearTimeout was not called in
    // the finally block, the abort callback would fire here and we'd see a
    // console.warn call (abort on an already-resolved fetch). The spy on
    // console.warn is set up in beforeEach — if it was called it means the
    // timer leaked and fired.
    await vi.advanceTimersByTimeAsync(3000);
    // console.warn should NOT have been called (no abort on a successful fetch)
    expect(console.warn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('handles malformed JSON in 200 response (CDN error page)', async () => {
    // Simulate CDN/proxy returning HTTP 200 with HTML error page instead of JSON
    fetchMock.mockResolvedValue(new Response('<html>503</html>', { status: 200 }));
    const result = await fetchInitConfig('emb_test123', 'https://api.memox.io');
    expect(result).toEqual({});
    expect(console.warn).toHaveBeenCalled();
  });
});
