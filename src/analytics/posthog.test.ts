import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capture, init, __resetForTesting } from './posthog';

const POSTHOG_HOST = 'https://us.i.posthog.com';

function lastFetchBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = fetchMock.mock.calls;
  if (calls.length === 0) throw new Error('fetch was not called');
  const lastCall = calls[calls.length - 1];
  const init = lastCall[1] as RequestInit | undefined;
  if (!init?.body) throw new Error('fetch called without body');
  return JSON.parse(init.body as string);
}

describe('PostHog analytics', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetForTesting();
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a no-op when not initialized', () => {
    capture('chat_widget_loaded');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a no-op when initialized without an apiKey', () => {
    init({ apiKey: null });
    capture('chat_widget_loaded');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists distinct_id in localStorage across init calls', () => {
    init({ apiKey: 'phc_test' });
    capture('chat_widget_loaded');
    const firstId = lastFetchBody(fetchMock).distinct_id;
    expect(typeof firstId).toBe('string');
    expect(firstId).toMatch(/^mmx-/);

    // Re-init should reuse the same id
    __resetForTesting();
    init({ apiKey: 'phc_test' });
    capture('chat_widget_loaded');
    expect(lastFetchBody(fetchMock).distinct_id).toBe(firstId);
  });

  it('posts capture events to the configured host', () => {
    init({ apiKey: 'phc_test', host: 'https://eu.i.posthog.com' });
    capture('chat_widget_loaded');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://eu.i.posthog.com/capture/');
    expect(options.method).toBe('POST');
    expect(options.keepalive).toBe(true);
    const body = lastFetchBody(fetchMock);
    expect(body.api_key).toBe('phc_test');
    expect(body.event).toBe('chat_widget_loaded');
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('defaults host to us.i.posthog.com when not provided', () => {
    init({ apiKey: 'phc_test' });
    capture('chat_widget_loaded');
    expect(fetchMock.mock.calls[0][0]).toBe(`${POSTHOG_HOST}/capture/`);
  });

  it('includes org_id, agent_id and page metadata in properties', () => {
    init({ apiKey: 'phc_test', orgId: 7, agentId: 'agent-42' });
    capture('chat_opened');

    const body = lastFetchBody(fetchMock);
    const props = body.properties as Record<string, unknown>;
    expect(props.org_id).toBe(7);
    expect(props.agent_id).toBe('agent-42');
    expect(props.page_url).toBe(window.location.href);
    expect(props.page_path).toBe(window.location.pathname);
    expect(props.page_title).toBe(document.title);
  });

  it('merges UTM params from URL into properties', () => {
    const original = window.location.href;
    // jsdom supports replacing window.location via defineProperty fallback
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=brand'),
      writable: true,
    });
    try {
      init({ apiKey: 'phc_test' });
      capture('chat_widget_loaded');
      const props = (lastFetchBody(fetchMock).properties as Record<string, unknown>);
      expect(props.utm_source).toBe('google');
      expect(props.utm_medium).toBe('cpc');
      expect(props.utm_campaign).toBe('brand');
    } finally {
      Object.defineProperty(window, 'location', {
        value: new URL(original),
        writable: true,
      });
    }
  });

  it('merges additional event properties', () => {
    init({ apiKey: 'phc_test' });
    capture('chat_lead_captured', { has_phone: true, has_zip: false });

    const props = (lastFetchBody(fetchMock).properties as Record<string, unknown>);
    expect(props.has_phone).toBe(true);
    expect(props.has_zip).toBe(false);
  });

  it('tags events with attractor_variant when configured', () => {
    init({ apiKey: 'phc_test', attractorVariant: 'pill+bubble+pulse' });
    capture('chat_opened');

    const props = (lastFetchBody(fetchMock).properties as Record<string, unknown>);
    expect(props.attractor_variant).toBe('pill+bubble+pulse');
  });

  it('defaults attractor_variant to round+bubble when not configured', () => {
    init({ apiKey: 'phc_test' });
    capture('chat_widget_loaded');

    const props = (lastFetchBody(fetchMock).properties as Record<string, unknown>);
    expect(props.attractor_variant).toBe('round+bubble');
  });

  it('falls back to round+bubble when attractor_variant is empty/null', () => {
    init({ apiKey: 'phc_test', attractorVariant: null });
    capture('chat_widget_loaded');
    expect(
      (lastFetchBody(fetchMock).properties as Record<string, unknown>).attractor_variant,
    ).toBe('round+bubble');

    fetchMock.mockClear();
    __resetForTesting();
    init({ apiKey: 'phc_test', attractorVariant: '' });
    capture('chat_widget_loaded');
    expect(
      (lastFetchBody(fetchMock).properties as Record<string, unknown>).attractor_variant,
    ).toBe('round+bubble');
  });

  it('swallows fetch errors silently (analytics never breaks the widget)', () => {
    fetchMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    init({ apiKey: 'phc_test' });
    expect(() => capture('chat_widget_loaded')).not.toThrow();
  });
});
