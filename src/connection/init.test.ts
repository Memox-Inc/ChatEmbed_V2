import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbedInitError, fetchInitConfig, normalizeServerConfig } from './init';

describe('fetchInitConfig', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Failure paths intentionally console.warn / console.error — silence in
    // tests so the suite output stays clean without losing them in production.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  // MMX-1027: in embedId mode a failed init MUST NOT resolve to {}. Returning
  // {} made index.ts mount the widget on defaultConfig — a generic blue "Chat"
  // widget with no token/agent_id, i.e. visibly wrong AND unable to chat. The
  // failure is now surfaced as a typed EmbedInitError so the caller can refuse
  // to mount and show an actionable message.

  it('throws EmbedInitError with reason "network" on fetch error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    await expect(fetchInitConfig('emb_test123', 'https://api.memox.io')).rejects.toMatchObject({
      name: 'EmbedInitError',
      reason: 'network',
    });
  });

  it('throws EmbedInitError with reason "origin" on 403 (origin not allowed)', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Origin not allowed.' }), { status: 403 }),
    );
    const err = await fetchInitConfig('emb_test123', 'https://api.memox.io').catch((e) => e);
    expect(err).toBeInstanceOf(EmbedInitError);
    expect(err.reason).toBe('origin');
    expect(err.status).toBe(403);
  });

  it('throws EmbedInitError with reason "not_found" on 404 (bad/inactive embedId)', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid or inactive embed configuration.' }), {
        status: 404,
      }),
    );
    const err = await fetchInitConfig('emb_test123', 'https://api.memox.io').catch((e) => e);
    expect(err).toBeInstanceOf(EmbedInitError);
    expect(err.reason).toBe('not_found');
  });

  it('throws EmbedInitError with reason "http" on other non-2xx responses', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const err = await fetchInitConfig('emb_test123', 'https://api.memox.io').catch((e) => e);
    expect(err).toBeInstanceOf(EmbedInitError);
    expect(err.reason).toBe('http');
    expect(err.status).toBe(500);
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

  it('aborts and throws EmbedInitError(timeout) when fetch hangs past INIT_TIMEOUT_MS', async () => {
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
    // Attach the rejection handler before advancing so the abort never lands
    // as an unhandled rejection.
    const settled = promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(6000);
    const err = await settled;
    expect(err).toBeInstanceOf(EmbedInitError);
    expect(err.reason).toBe('timeout');

    vi.useRealTimers();
  });

  // Asserts the clearTimeout call directly. The previous version asserted that
  // ``console.warn`` was never called, which could not fail: aborting an
  // already-settled fetch is a no-op, so a leaked timer produced no log at all
  // — the test passed with the clearTimeout removed entirely.
  //
  // Note we can't assert ``vi.getTimerCount() === 0`` either: getOrCreateDistinctId
  // schedules its own timer that is still pending here, so the count is 1 even on
  // the correct path.
  it('clears the timeout timer on successful fetch (no leaked timer)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, _opts: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ embed_id: 'emb', config: { foo: 'bar' } }), { status: 200 }),
      ),
    ));

    // Installed after useFakeTimers so we spy on the faked clearTimeout.
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    const result = await fetchInitConfig('emb', 'https://api.example.com');
    expect(result).toEqual({ foo: 'bar' });

    // The finally block must clear the abort timer on the success path. Fails
    // if the clearTimeout is removed — nothing else in this flow clears a timer.
    expect(clearSpy).toHaveBeenCalled();

    // Belt-and-braces: advancing past INIT_TIMEOUT_MS must not resurrect an
    // abort or produce any failure logging.
    await vi.advanceTimersByTimeAsync(6000);
    expect(console.error).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('throws EmbedInitError on malformed JSON in a 200 response (CDN error page)', async () => {
    // Simulate CDN/proxy returning HTTP 200 with an HTML error page instead of JSON
    fetchMock.mockResolvedValue(new Response('<html>503</html>', { status: 200 }));
    const err = await fetchInitConfig('emb_test123', 'https://api.memox.io').catch((e) => e);
    expect(err).toBeInstanceOf(EmbedInitError);
    expect(err.reason).toBe('bad_response');
    expect(console.error).toHaveBeenCalled();
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
