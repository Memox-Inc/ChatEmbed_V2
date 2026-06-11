/**
 * Bootstrap analytics contract test — T1
 *
 * Verifies that when the widget boots and fetchInitConfig returns a server
 * config with an attractor_variant, the `chat_widget_loaded` PostHog event
 * is fired with that variant string as `attractor_variant`.
 *
 * Strategy: vi.mock hoisting ensures mocks are in place before the module
 * executes its top-level bootstrap. We flush the async init() promise with
 * a microtask/macrotask drain, then inspect the capture spy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before all imports by vitest) ─────────────────────────────

// 1. Server init — return a known attractor_variant
vi.mock('./connection/init', () => ({
  fetchInitConfig: vi.fn().mockResolvedValue({
    attractor_variant: 'round+bubble+pulse',
  }),
}));

// 2. PostHog analytics — spy on init + capture
const captureSpy = vi.fn();
const analyticsInitSpy = vi.fn();
vi.mock('./analytics/posthog', () => ({
  init: analyticsInitSpy,
  capture: captureSpy,
  identify: vi.fn(),
  group: vi.fn(),
  __resetForTesting: vi.fn(),
}));

// 3. API client — prevent network calls during maybeShowLeadCapture
vi.mock('./connection/api-client', () => ({
  validateSession: vi.fn().mockResolvedValue('valid'),
  createVisitor: vi.fn().mockResolvedValue({ id: 'v_test', name: null }),
}));

// 4. WebSocket manager — prevent real WebSocket connections
vi.mock('./connection/websocket-manager', () => ({
  WebSocketManager: vi.fn().mockImplementation(() => ({
    connected: false,
    readyState: 3, // CLOSED
    connect: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Drain the microtask queue + one macrotask tick so async init() resolves. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Set up window config BEFORE the module is imported (top-level bootstrap fires on import).
// vi.mock is hoisted, but window globals are not — so we set them here at module scope.
window.MemoxChatConfig = {
  embedId: 'emb_test',
  memoxPosthogApiKey: 'phc_test',
  // Disable lead capture so maybeShowLeadCapture goes through the anonymous-visitor
  // path, avoiding the form UI which needs additional DOM scaffolding.
  leadCapture: false,
} as unknown as typeof window.MemoxChatConfig;

describe('index bootstrap — chat_widget_loaded analytics contract', () => {
  // The module is imported once and its top-level bootstrap fires exactly once.
  // All assertions live in a single test that awaits the async init() promise.
  it('fires chat_widget_loaded with attractor_variant from server config', async () => {
    // Importing index triggers bootstrap() immediately — document.readyState is
    // 'complete' in jsdom so the DOMContentLoaded guard is bypassed.
    await import('./index');

    // Allow the async init() promise chain to fully resolve:
    //   fetchInitConfig (mocked, resolves in microtask)
    //   → analytics.init(...)
    //   → analytics.capture('chat_widget_loaded')
    // A single macrotask tick is sufficient.
    await flushAsync();

    // 1. analytics.init was called with the server-supplied attractor_variant
    expect(analyticsInitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ attractorVariant: 'round+bubble+pulse' }),
    );

    // 2. chat_widget_loaded was fired
    expect(captureSpy).toHaveBeenCalledWith('chat_widget_loaded');

    // 3. init was called BEFORE capture so the variant is registered in time
    const initOrder = analyticsInitSpy.mock.invocationCallOrder[0];
    const loadedCallIdx = captureSpy.mock.calls.findIndex(
      (args) => args[0] === 'chat_widget_loaded',
    );
    const loadedOrder = captureSpy.mock.invocationCallOrder[loadedCallIdx];
    expect(initOrder).toBeDefined();
    expect(loadedOrder).toBeDefined();
    expect(initOrder).toBeLessThan(loadedOrder!);
  });
});

// ── MMX-598: Memox-namespaced PostHog config rename ───────────────────────────

describe('widget reads memox-namespaced PostHog config (MMX-598)', () => {
  beforeEach(() => {
    vi.resetModules();
    analyticsInitSpy.mockClear();
    captureSpy.mockClear();
  });

  it('passes memoxPosthogApiKey from config into analytics.init', async () => {
    (window as any).MemoxChatConfig = {
      embedId: undefined,
      memoxPosthogApiKey: 'phc_test_memox_key',
      memoxPosthogHost: 'https://us.i.posthog.com',
      leadCapture: false,
    };

    await import('./index');
    await flushAsync();

    expect(analyticsInitSpy).toHaveBeenCalled();
    const callArg = analyticsInitSpy.mock.calls[0][0];
    expect(callArg.apiKey).toBe('phc_test_memox_key');
    expect(callArg.host).toBe('https://us.i.posthog.com');
  });

  it('ignores legacy posthogApiKey field (does not read it for Memox events)', async () => {
    (window as any).MemoxChatConfig = {
      embedId: undefined,
      posthogApiKey: 'phc_customer_owned_must_not_leak',
      leadCapture: false,
    };

    await import('./index');
    await flushAsync();

    expect(analyticsInitSpy).toHaveBeenCalled();
    const callArg = analyticsInitSpy.mock.calls[0][0];
    expect(callArg.apiKey).toBeUndefined();
  });
});
