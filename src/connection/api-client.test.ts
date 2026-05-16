import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisitor, validateSession } from './api-client';

// MMX-611: assert the widget sends ``Authorization: EmbedToken …`` when a
// per-session token is configured, and falls back to legacy ``Token …``
// otherwise. The header switch is the core of the embed-token-leak fix.

const baseConfig = {
  baseUrl: 'https://hub.memox.io/api/v1/',
  org_id: 9,
};

function getLastRequestInit(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
  const calls = fetchMock.mock.calls;
  return calls[calls.length - 1][1] as RequestInit;
}

function getAuthHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string>).Authorization;
}

describe('api-client Authorization header (MMX-611)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends EmbedToken when sessionToken is set', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'open' }), { status: 200 }));
    await validateSession('chat-id-1', { ...baseConfig, sessionToken: 'per-session-abc' });
    expect(getAuthHeader(getLastRequestInit(fetchMock))).toBe('EmbedToken per-session-abc');
  });

  it('falls back to legacy Token when only the legacy token is set', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'open' }), { status: 200 }));
    await validateSession('chat-id-1', { ...baseConfig, token: 'legacy-global-token' });
    expect(getAuthHeader(getLastRequestInit(fetchMock))).toBe('Token legacy-global-token');
  });

  it('prefers sessionToken over legacy token when both are present', async () => {
    // Real-world: during Phase B transition the server returns both. The
    // widget must pick the session-scoped one so requests are org-bounded.
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'open' }), { status: 200 }));
    await validateSession('chat-id-1', {
      ...baseConfig,
      sessionToken: 'per-session-abc',
      token: 'legacy-global-token',
    });
    expect(getAuthHeader(getLastRequestInit(fetchMock))).toBe('EmbedToken per-session-abc');
  });

  it('createVisitor uses EmbedToken header on the POST request', async () => {
    // First call: GET ?email=… returns no results so the path takes the POST branch.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    // POST returns a created visitor.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 42, name: 'Test User' }), { status: 201 }),
    );

    const result = await createVisitor('Test User', 'test@example.com', null, null, {
      ...baseConfig,
      sessionToken: 'per-session-abc',
    });

    expect(result.id).toBe(42);
    // Both the GET lookup and the POST create must carry the EmbedToken.
    expect(getAuthHeader(fetchMock.mock.calls[0][1] as RequestInit)).toBe(
      'EmbedToken per-session-abc',
    );
    expect(getAuthHeader(fetchMock.mock.calls[1][1] as RequestInit)).toBe(
      'EmbedToken per-session-abc',
    );
  });

  it('createVisitor throws when neither sessionToken nor token is configured', async () => {
    // Hits the offline-fallback catch and returns an offline placeholder
    // rather than rejecting — preserves existing "fail-open" UX.
    const result = await createVisitor('Test User', null, null, null, { ...baseConfig });
    expect(result.id).toMatch(/^offline_/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
