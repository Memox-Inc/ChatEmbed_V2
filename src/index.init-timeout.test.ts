/**
 * enableWhenReady retry exhaustion test — T2
 *
 * Verifies that when the WebSocket never becomes OPEN and enableWhenReady
 * exhausts its 20-retry cap (~6s at 300ms intervals + 500ms initial delay),
 * the widget:
 *   1. Inserts a `.mcx-init-error` element inside the chat panel.
 *   2. Captures a `widget_init_timeout` PostHog event with the expected payload.
 *
 * Strategy:
 *   - vi.mock hoisting ensures mocks are in place before the module runs.
 *   - `createLeadCaptureForm` is mocked to immediately call onComplete so we
 *     reach the enableWhenReady polling loop without any real DOM form.
 *   - `createShadowHost` is mocked to use mode:'open' so jsdom exposes the
 *     shadow root for querying (production uses 'closed' for isolation).
 *   - vi.useFakeTimers() lets us advance 500ms (initial delay) + 20 * 300ms
 *     (retry intervals) synchronously without real waiting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before all imports by vitest) ─────────────────────────────

// 1. Server init — return minimal config, no attractor_variant
vi.mock('./connection/init', () => ({
  fetchInitConfig: vi.fn().mockResolvedValue({}),
}));

// 2. PostHog analytics — capture spy is what we assert on
const captureSpy = vi.fn();
vi.mock('./analytics/posthog', () => ({
  init: vi.fn(),
  capture: captureSpy,
  __resetForTesting: vi.fn(),
}));

// 3. API client — suppress network calls
vi.mock('./connection/api-client', () => ({
  validateSession: vi.fn().mockResolvedValue('valid'),
  createVisitor: vi.fn().mockResolvedValue({ id: 'v_test', name: null }),
}));

// 4. WebSocket manager — always CLOSED so enableWhenReady never resolves
vi.mock('./connection/websocket-manager', () => ({
  WebSocketManager: vi.fn().mockImplementation(() => ({
    connected: false,
    readyState: 3, // CLOSED
    connect: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  })),
}));

// 5. Lead capture form — immediately invokes onComplete so we skip
//    real form DOM and reach the enableWhenReady polling loop right away.
vi.mock('./ui/forms/lead-capture-form', () => ({
  createLeadCaptureForm: vi.fn().mockImplementation(
    (_config: unknown, onComplete: (lead: Record<string, string> | null) => void) => {
      // Call onComplete synchronously with a fake lead so the widget
      // proceeds past the form phase into the enableWhenReady loop.
      onComplete({
        name: 'Test User',
        email: 'test@example.com',
        phone: '5551234567',
        zip: '10001',
        timestamp: new Date().toISOString(),
        userAgent: '',
        platform: '',
        url: '',
        language: '',
        referrer: '',
      });
      return document.createElement('div');
    },
  ),
}));

// 6. Shadow host — use mode:'open' so jsdom exposes the root via host.shadowRoot.
//    Production uses 'closed' for isolation; tests need 'open' for assertions.
vi.mock('./ui/shadow-host', () => ({
  createShadowHost: () => {
    const host = document.createElement('div');
    host.id = 'memox-chat-embed-host';
    const root = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
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

// ── Setup ─────────────────────────────────────────────────────────────────────

// Enable leadCapture so showLeadForm() is triggered.
window.MemoxChatConfig = {
  embedId: 'emb_timeout_test',
  posthogApiKey: 'phc_test',
  leadCapture: true,
} as unknown as typeof window.MemoxChatConfig;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('enableWhenReady — retry exhaustion (T2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    captureSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up shadow hosts mounted during the test
    document.querySelectorAll('#memox-chat-embed-host').forEach((el) => el.remove());
  });

  it('inserts .mcx-init-error and captures widget_init_timeout after 20 retries', async () => {
    // Import triggers bootstrap() synchronously. fetchInitConfig resolves in
    // a microtask; the rest of init() runs after we flush below.
    await import('./index');

    // Flush the async init() promise so fetchInitConfig + maybeShowLeadCapture
    // complete and showLeadForm() fires, which calls the mocked
    // createLeadCaptureForm → onComplete immediately.
    // vi.advanceTimersByTimeAsync(0) drains both the microtask queue and any
    // zero-delay macrotasks (fetchInitConfig mock + the setTimeout(..., 100)
    // for checkAndAutoConnect).
    await vi.advanceTimersByTimeAsync(0);

    // The form mock calls onComplete synchronously during showLeadForm(), which
    // schedules: setTimeout(enableWhenReady, 500) — the initial delay.
    // Advance past that.
    await vi.advanceTimersByTimeAsync(500);

    // Each retry does: setTimeout(enableWhenReady, 300). There are 20 retries.
    // Advance 20 * 300ms = 6000ms to exhaust all retries.
    await vi.advanceTimersByTimeAsync(20 * 300);

    // --- Assertions ---

    // 1. A .mcx-init-error element should exist in the open shadow root.
    const host = document.getElementById('memox-chat-embed-host');
    const shadowRoot = host?.shadowRoot ?? null;
    const errorEl = shadowRoot?.querySelector('.mcx-init-error') ?? null;

    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Unable to connect');

    // 2. PostHog capture was called with widget_init_timeout
    expect(captureSpy).toHaveBeenCalledWith(
      'widget_init_timeout',
      { reason: 'enableWhenReady_max_retries' },
    );
  });
});
