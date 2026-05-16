import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postEmbedEvent } from './embed-events';

describe('postEmbedEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts chat_opened with embed_id, distinct_id, metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await postEmbedEvent({
      baseUrl: 'https://hub.memox.io/api/v1/',
      embedId: 'emb_abc',
      eventType: 'chat_opened',
      distinctId: 'anon_123',
      metadata: { trigger: 'manual' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hub.memox.io/api/v1/embed/events/');
    expect(opts.method).toBe('POST');
    expect(opts.keepalive).toBe(true);
    expect(JSON.parse(opts.body as string)).toEqual({
      embed_id: 'emb_abc',
      event_type: 'chat_opened',
      distinct_id: 'anon_123',
      metadata: { trigger: 'manual' },
    });
  });

  it('posts form_submitted with visitor_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await postEmbedEvent({
      baseUrl: 'https://hub.memox.io/api/v1/',
      embedId: 'emb_abc',
      eventType: 'form_submitted',
      distinctId: 'anon_123',
      visitorId: 42,
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body as string)).toMatchObject({
      embed_id: 'emb_abc',
      event_type: 'form_submitted',
      visitor_id: 42,
    });
  });

  it('never throws on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(
      postEmbedEvent({
        baseUrl: 'https://hub.memox.io/api/v1/',
        embedId: 'emb_abc',
        eventType: 'chat_opened',
      }),
    ).resolves.toBeUndefined();
  });
});
