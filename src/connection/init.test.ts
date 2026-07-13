import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInitConfig, normalizeServerConfig } from './init';

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

  it('exposes session_token from server response as runtime.sessionToken (MMX-611)', async () => {
    // The widget should prefer the per-session embed token over the
    // legacy global token. Both arrive on the same /embed/init/ response
    // during the Phase B transition; PR3 will drop the legacy field.
    const mockResponse = {
      embed_id: 'emb_x',
      token: 'legacy-global-token',
      session_token: 'per-session-abc123',
      config: {},
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

    const result = await fetchInitConfig('emb_x', 'https://api.memox.io');
    expect(result.sessionToken).toBe('per-session-abc123');
    // Legacy token remains exposed so the fallback path keeps working
    // until PR3 strips it server-side. buildHeaders picks the right one.
    expect(result.token).toBe('legacy-global-token');
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
    await vi.advanceTimersByTimeAsync(6000);
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
    await vi.advanceTimersByTimeAsync(6000);
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

describe('normalizeServerConfig — theme snake→camel bridge', () => {
  it('aliases snake_case theme tokens to camelCase so widget UI reads pick them up', () => {
    const out = normalizeServerConfig({
      theme: {
        user_bubble: '#ee3028',
        bot_avatar_svg_color: '#8349ff',
        handover_notification_bg: '#f6e3e3',
        // Already-camel keys must NOT be clobbered.
        primary: '#aaa',
      },
    });
    expect(out.theme.userBubble).toBe('#ee3028');
    expect(out.theme.botAvatarSvgColor).toBe('#8349ff');
    expect(out.theme.handoverNotificationBg).toBe('#f6e3e3');
    // Both shapes co-exist so applyTheme's snake_case branch still works.
    expect(out.theme.user_bubble).toBe('#ee3028');
    expect(out.theme.primary).toBe('#aaa');
  });

  it('leaves non-theme block untouched when theme is missing', () => {
    const out = normalizeServerConfig({ welcome_message: 'hi' });
    expect(out.theme).toBeUndefined();
    expect(out.welcomeMessage).toBe('hi');
  });

  it('does not blow up on an array-typed theme (defensive)', () => {
    const out = normalizeServerConfig({ theme: ['oops'] as unknown as Record<string, unknown> });
    // Array passes through untouched — guards against future bad payloads.
    expect(Array.isArray(out.theme)).toBe(true);
  });

  it('aliases memox_posthog_api_key / memox_posthog_host to camelCase (MMX-598)', () => {
    const out = normalizeServerConfig({
      memox_posthog_api_key: 'phc_x',
      memox_posthog_host: 'https://eu.i.posthog.com',
    });
    expect(out.memoxPosthogApiKey).toBe('phc_x');
    expect(out.memoxPosthogHost).toBe('https://eu.i.posthog.com');
  });
});
