import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInitConfig } from '../src/connection/init';

const MOCK_RESPONSE = {
  embed_id: 'emb_test123',
  config: {
    attractor_variant: 'round+bubble',
  },
};

describe('fetchInitConfig — disableExperiments flag', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('(a) default init body includes distinct_id and does NOT include disable_experiments', async () => {
    await fetchInitConfig('emb_test123', 'https://hub.memox.io');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);

    expect(body.distinct_id).toBeDefined();
    expect(typeof body.distinct_id).toBe('string');
    expect(body.distinct_id).toMatch(/^mmx-/);
    expect(body.disable_experiments).toBeUndefined();
  });

  it('(b) when disableExperiments=true, init body OMITS distinct_id and includes disable_experiments: true', async () => {
    await fetchInitConfig('emb_test123', 'https://hub.memox.io', true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);

    expect(body.distinct_id).toBeUndefined();
    expect(body.disable_experiments).toBe(true);
  });

  it('still includes embed_id, page_url, page_title when disableExperiments=true', async () => {
    await fetchInitConfig('emb_abc', 'https://hub.memox.io', true);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);

    expect(body.embed_id).toBe('emb_abc');
    expect(typeof body.page_url).toBe('string');
    expect(typeof body.page_title).toBe('string');
  });

  it('distinct_id is persisted in localStorage on default (non-disabled) init', async () => {
    await fetchInitConfig('emb_test123', 'https://hub.memox.io');
    const storedId = localStorage.getItem('mmx_chat_distinct_id');
    expect(storedId).toBeTruthy();
    expect(storedId).toMatch(/^mmx-/);
  });
});
