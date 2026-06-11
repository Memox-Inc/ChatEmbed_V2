import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisitor } from '../src/connection/api-client';
import type { ChatEmbedConfig } from '../src/config/types';

// MMX-804: a name-only lead submission (email/phone/zip disabled) must persist
// the submitted name and create a non-anonymous visitor — not overwrite the
// name with "Anonymous Visitor".

const CONFIG = {
  baseUrl: 'https://hub.memox.io/api/v1/',
  sessionToken: 'sess_test',
  org_id: 7,
} as unknown as ChatEmbedConfig;

function bodyOf(call: unknown[]): Record<string, unknown> {
  const [, options] = call as [string, RequestInit];
  return JSON.parse(options.body as string);
}

describe('createVisitor — name-only lead (MMX-804)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    // GET lookup → not found, POST create → echo the payload back with an id.
    fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (!options || options.method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
      }
      const payload = JSON.parse(options.body as string);
      return Promise.resolve(
        new Response(JSON.stringify({ id: 123, ...payload }), { status: 201 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists the submitted name and marks the visitor non-anonymous', async () => {
    const result = await createVisitor('Jane Doe', null, null, null, CONFIG);

    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const payload = bodyOf(postCall!);

    expect(payload.name).toBe('Jane Doe');
    expect((payload.metadata as Record<string, unknown>).anonymous).toBe(false);
    // A synthetic per-browser email is used as the identity key.
    expect(String(payload.email)).toMatch(/^anonymous_.*@memox\.local$/);
    expect(result.name).toBe('Jane Doe');
  });

  it('falls back to the placeholder + anonymous flag when no lead data at all', async () => {
    await createVisitor(null, null, null, null, CONFIG);

    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    const payload = bodyOf(postCall!);

    expect(payload.name).toBe('Anonymous Visitor');
    expect((payload.metadata as Record<string, unknown>).anonymous).toBe(true);
  });

  it('keeps the real email + name unchanged for email-bearing submissions', async () => {
    await createVisitor('Bob', 'bob@acme.com', null, null, CONFIG);

    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    const payload = bodyOf(postCall!);

    expect(payload.name).toBe('Bob');
    expect(payload.email).toBe('bob@acme.com');
    expect((payload.metadata as Record<string, unknown>).anonymous).toBe(false);
  });
});

describe('createVisitor — existing placeholder record gets its name patched (MMX-804)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (!options || options.method === 'GET') {
        // Existing visitor found, still named with the placeholder.
        return Promise.resolve(
          new Response(
            JSON.stringify({ results: [{ id: 55, name: 'Anonymous Visitor' }] }),
            { status: 200 },
          ),
        );
      }
      if (options.method === 'PATCH') {
        const payload = JSON.parse(options.body as string);
        return Promise.resolve(new Response(JSON.stringify({ id: 55, ...payload }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('PATCHes the placeholder-named visitor with the newly submitted name', async () => {
    const result = await createVisitor('Jane Doe', null, null, null, CONFIG);

    const patchCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(String(patchCall![0])).toMatch(/visitors\/55\/$/);
    expect(JSON.parse((patchCall![1] as RequestInit).body as string).name).toBe('Jane Doe');
    expect(result.name).toBe('Jane Doe');
  });
});
