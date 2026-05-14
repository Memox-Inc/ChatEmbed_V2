/**
 * Session-close idempotency — MMX-573.
 *
 * Bug: when a chat session expires, three independent code paths
 * (`connectWebSocket` REST validate, `handleToggle` REST validate, inbound
 * WS `error_message`) all call `showSessionClosedNotification`. The function
 * was not idempotent — each call scheduled its own 3-second `resetSession`
 * timer, producing stacked banners and stacked lead forms.
 *
 * This test simulates three rapid WS `error_message` frames and asserts:
 *   1. exactly ONE `.mcx-sys-notification--closed` banner DOM node.
 *   2. after the 3s reset timer fires, exactly ONE `.mcx-lead-conv` form.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Server init — minimal config, lead capture enabled.
vi.mock('./connection/init', () => ({
  fetchInitConfig: vi.fn().mockResolvedValue({}),
}));

// PostHog — no-op.
vi.mock('./analytics/posthog', () => ({
  init: vi.fn(),
  capture: vi.fn(),
  __resetForTesting: vi.fn(),
}));

// API client — never closed on first validate (this isn't the path we test).
vi.mock('./connection/api-client', () => ({
  validateSession: vi.fn().mockResolvedValue('valid'),
  createVisitor: vi.fn().mockResolvedValue({ id: 'v_test', name: 'Test' }),
}));

// WebSocket manager — capture the onMessage handler so the test can fire
// `error_message` frames at will.
let capturedOnMessage: ((data: Record<string, unknown>) => void) | null = null;
vi.mock('./connection/websocket-manager', () => ({
  WebSocketManager: vi.fn().mockImplementation(
    (_config: unknown, onMessage: (data: Record<string, unknown>) => void) => {
      capturedOnMessage = onMessage;
      return {
        connected: false,
        readyState: 1, // OPEN
        connect: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      };
    },
  ),
}));

// Lead-capture form — return a real node with the production class so the
// test can count form instances in the DOM. The widget appends this to the
// widget container; the bug is that it appends without removing prior forms.
vi.mock('./ui/forms/lead-capture-form', () => ({
  createLeadCaptureForm: vi.fn().mockImplementation(() => {
    const el = document.createElement('div');
    el.className = 'mcx-lead-conv';
    return el;
  }),
}));

// Shadow host — mode:'open' so the test can query inside the shadow root.
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

window.MemoxChatConfig = {
  embedId: 'emb_session_close_test',
  // Seed visitor + chatID in localStorage so the widget skips lead capture
  // on init and goes straight to the connected state (mirrors a returning
  // visitor whose backend session has just been auto-closed).
  leadCapture: true,
} as unknown as typeof window.MemoxChatConfig;

describe('session-close idempotency (MMX-573)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedOnMessage = null;
    // Seed an existing session so the widget bypasses the lead form on
    // boot and we land in the connected state where the server's
    // `error_message` is the entry point we want to exercise.
    // SessionStore default prefix is ``simple-chat`` (see session-store.ts).
    localStorage.setItem(
      'simple-chat-session',
      JSON.stringify({
        chatID: 'room-MMX-573-test',
        timestamp: new Date().toISOString(),
        visitorInfo: { id: 'v_test', name: 'Test' },
      }),
    );
    localStorage.setItem(
      'simple-chat-messages',
      JSON.stringify([
        { text: 'Hi', sender: 'ai', isWelcomeMessage: false, created_at: '12:00' },
      ]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('#memox-chat-embed-host').forEach((el) => el.remove());
    localStorage.clear();
  });

  it('renders exactly one banner + one lead form after 3 rapid error_message frames', async () => {
    const indexModule = await import('./index');
    // Trigger init.
    await vi.dynamicImportSettled?.();
    // Allow microtasks (fetchInitConfig promise, etc.) to flush.
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);

    // Confirm the WS handler is wired.
    expect(capturedOnMessage, 'WS onMessage should be captured').toBeTruthy();
    if (!capturedOnMessage) return; // tsc narrowing

    // Fire three error_message frames in rapid succession — this is the
    // race that previously stacked banners and forms.
    for (let i = 0; i < 3; i++) {
      capturedOnMessage({
        message_type: 'error_message',
        content: 'This chat session has been closed.',
        room_name: 'room-MMX-573-test',
      });
    }

    // Synchronously after the burst — exactly one banner.
    const host = document.querySelector('#memox-chat-embed-host') as HTMLElement;
    const root = host.shadowRoot as ShadowRoot;
    const banners = root.querySelectorAll('.mcx-sys-notification--closed');
    expect(banners.length, 'one banner per session close, not N').toBe(1);

    // UX assertions: the friendly toast has a countdown number and a
    // "Start now" button (MMX-573 UX polish).
    const toast = banners[0] as HTMLElement;
    const countdown = toast.querySelector('.mcx-session-ended-countdown');
    expect(countdown, 'countdown number is rendered').toBeTruthy();
    expect(countdown?.textContent, 'countdown starts at 3').toBe('3');
    const startBtn = toast.querySelector('.mcx-session-ended-start') as HTMLButtonElement | null;
    expect(startBtn, '"Start now" button is rendered').toBeTruthy();

    // Tick the countdown forward by 1s — number should drop to 2.
    await vi.advanceTimersByTimeAsync(1000);
    expect(countdown?.textContent, 'countdown ticks down').toBe('2');

    // Advance past the rest of the countdown — reset should fire.
    await vi.advanceTimersByTimeAsync(2500);
    await Promise.resolve();

    // After reset → exactly one lead form mounted on the widget.
    const forms = root.querySelectorAll('.mcx-lead-conv');
    expect(forms.length, 'one lead form after reset, not N').toBe(1);

    // The lead form lives directly under the widget container, not under
    // the messages list — confirms the original mounting point still works.
    const widget = root.querySelector('.mcx-widget') as HTMLElement | null;
    expect(widget, 'widget container exists').toBeTruthy();
    expect(widget?.querySelector('.mcx-lead-conv')).toBeTruthy();

    // Silence unused-import warning for re-imports across tests in watch mode.
    void indexModule;
  });

  it('anonymous mode (leadCapture: false) — single toast + no lead form after reset', async () => {
    // Re-configure to anonymous mode and re-import the module fresh.
    window.MemoxChatConfig = {
      embedId: 'emb_session_close_anon_test',
      leadCapture: false,
    } as unknown as typeof window.MemoxChatConfig;
    vi.resetModules();

    await import('./index');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedOnMessage, 'WS onMessage captured (anon path)').toBeTruthy();
    if (!capturedOnMessage) return;

    // Fire 5 rapid close events — stress the idempotency latch.
    for (let i = 0; i < 5; i++) {
      capturedOnMessage({
        message_type: 'error_message',
        content: 'This chat session has been closed.',
        room_name: 'room-MMX-573-test',
      });
    }

    const host = document.querySelector('#memox-chat-embed-host') as HTMLElement;
    const root = host.shadowRoot as ShadowRoot;

    // Still exactly one toast — same idempotency guarantee in anonymous mode.
    expect(
      root.querySelectorAll('.mcx-sys-notification--closed').length,
      'one toast in anonymous mode, not N',
    ).toBe(1);

    // Wait past the countdown so resetSession completes.
    await vi.advanceTimersByTimeAsync(4500);
    await Promise.resolve();
    await Promise.resolve();

    // Anonymous mode reset path should NOT mount a lead form — straight
    // back into chat with a welcome message.
    expect(
      root.querySelectorAll('.mcx-lead-conv').length,
      'no lead form in anonymous mode',
    ).toBe(0);
  });
});
