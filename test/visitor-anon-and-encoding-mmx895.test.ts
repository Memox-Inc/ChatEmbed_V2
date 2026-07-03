import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisitor } from '../src/connection/api-client';
import { createAnonymousEmail } from '../src/connection/browser-metadata';
import type { ChatEmbedConfig } from '../src/config/types';

// MMX-895 — two widget-side contributors to the "anonymous chats" bug:
//  (1) the GET lookup pasted the email unencoded, so a "+" address was
//      decoded server-side as a space → the lookup missed the existing row →
//      the widget POSTed a duplicate → 500 → visitor-less session.
//  (2) the synthetic anonymous email was keyed to a userAgent/device
//      fingerprint, identical for every visitor on the same browser, so two
//      different people collided on one email → the second one's create 500'd.

const CONFIG = {
  baseUrl: 'https://hub.memox.io/api/v1/',
  sessionToken: 'sess_test',
  org_id: 7,
} as unknown as ChatEmbedConfig;

describe('createVisitor — GET lookup URL-encodes the email (MMX-895)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (!options || options.method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
      }
      const payload = JSON.parse(options.body as string);
      return Promise.resolve(new Response(JSON.stringify({ id: 1, ...payload }), { status: 201 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('encodes "+" as %2B so the lookup matches the stored row', async () => {
    await createVisitor('Jane', 'jane+leads@acme.com', null, null, CONFIG);

    const getCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'GET' || c[1] === undefined,
    );
    expect(getCall).toBeDefined();
    const url = String(getCall![0]);
    expect(url).toContain('email=jane%2Bleads%40acme.com');
    expect(url).not.toContain('jane+leads@acme.com'); // never sent raw
  });
});

describe('createAnonymousEmail — per-browser, not per-device (MMX-895)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('produces a memox.local anonymous address', () => {
    const email = createAnonymousEmail();
    expect(email).toMatch(/^anonymous_[a-zA-Z0-9]+@memox\.local$/);
  });

  it('is stable across calls in the same browser (returning visitor resolves to one row)', () => {
    const a = createAnonymousEmail();
    const b = createAnonymousEmail();
    expect(a).toBe(b);
  });

  it('differs once the browser identity differs (two people no longer collide)', () => {
    const first = createAnonymousEmail();
    // A different browser / cleared identity → a fresh distinct_id → distinct email.
    localStorage.clear();
    const second = createAnonymousEmail();
    expect(second).not.toBe(first);
  });
});
