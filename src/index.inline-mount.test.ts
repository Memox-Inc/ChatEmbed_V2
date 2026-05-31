/**
 * Inline-mount path test — B1
 *
 * Asserts that when ``mode: 'inline'`` is combined with a ``parentSelector``
 * pointing at a real element in the DOM, the widget mounts its shadow host
 * INSIDE that element (and not on ``document.body`` as the floating path
 * would). Without this guarantee the inline mode silently falls back to
 * floating, which is the regression the reviewer flagged as B1.
 *
 * Strategy mirrors the T2 timeout test: stub the network and form layers so
 * ``init()`` reaches the shadow-host branch without touching real WS / fetch.
 * Use ``mode: 'open'`` shadow root so we can assert the resulting tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./connection/init', () => ({
  fetchInitConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('./analytics/posthog', () => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  group: vi.fn(),
  __resetForTesting: vi.fn(),
}));

vi.mock('./connection/api-client', () => ({
  validateSession: vi.fn().mockResolvedValue('valid'),
  createVisitor: vi.fn().mockResolvedValue({ id: 'v_test', name: null }),
}));

vi.mock('./connection/websocket-manager', () => ({
  WebSocketManager: vi.fn().mockImplementation(() => ({
    connected: false,
    readyState: 3,
    connect: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  })),
}));

// Lead form is skipped — inline mode doesn't show one, but mock keeps boot path simple.
vi.mock('./ui/forms/lead-capture-form', () => ({
  createLeadCaptureForm: vi.fn().mockImplementation(
    (_config: unknown, onComplete: (lead: Record<string, string> | null) => void) => {
      onComplete(null);
      return document.createElement('div');
    },
  ),
}));

vi.mock('./ui/shadow-host', () => ({
  createShadowHost: () => {
    const host = document.createElement('div');
    host.id = 'memox-chat-embed-host';
    const root = host.attachShadow({ mode: 'open' });
    return { host, root };
  },
  createInlineShadowHost: (parent: HTMLElement) => {
    const host = document.createElement('div');
    host.id = 'memox-chat-embed-host';
    const root = host.attachShadow({ mode: 'open' });
    parent.appendChild(host);
    return { host, root };
  },
}));

describe('inline mount path — parentSelector (B1)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as { MemoxChatConfig?: unknown }).MemoxChatConfig;
    delete (window as unknown as { SimpleChatEmbedConfig?: unknown }).SimpleChatEmbedConfig;
  });

  afterEach(() => {
    // ``clearAllMocks`` resets call data without wiping the
    // ``mockResolvedValue`` implementations set on ``fetchInitConfig`` /
    // ``createVisitor`` etc. above. ``restoreAllMocks`` would strip those
    // and the second case would see ``serverConfig === undefined`` in
    // ``mergeConfig``, crashing the boot path.
    vi.clearAllMocks();
  });

  it('mounts the shadow host inside the element matched by parentSelector', async () => {
    const target = document.createElement('section');
    target.id = 'my-inline-target';
    document.body.appendChild(target);

    window.MemoxChatConfig = {
      embedId: 'emb_inline_test',
      mode: 'inline',
      parentSelector: '#my-inline-target',
      leadCapture: false,
    } as unknown as typeof window.MemoxChatConfig;

    // Import after the global is set — index.ts reads window.MemoxChatConfig at module load.
    await import('./index');
    // Yield twice so the async init() bootstrap + first WS readiness tick complete.
    await Promise.resolve();
    await Promise.resolve();

    const inside = target.querySelector('#memox-chat-embed-host');
    expect(inside).not.toBeNull();
    // The host must NOT have been appended to body — that would be the
    // floating-mode fallback the reviewer warned about.
    expect(document.body.querySelector(':scope > #memox-chat-embed-host')).toBeNull();
  });

  it('falls back to document.body when parentSelector does not match any element', async () => {
    window.MemoxChatConfig = {
      embedId: 'emb_inline_missing',
      mode: 'inline',
      parentSelector: '#does-not-exist',
      leadCapture: false,
    } as unknown as typeof window.MemoxChatConfig;

    vi.resetModules();
    await import('./index');
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.querySelector('#memox-chat-embed-host')).not.toBeNull();
  });
});
