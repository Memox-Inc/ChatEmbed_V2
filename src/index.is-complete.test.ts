/**
 * is_complete re-render — data-message-id targeted bubble removal.
 *
 * Regression: the original code removed the last `.mcx-msg-group` in the DOM
 * (positional) when a streaming message finished. If a second group was
 * interleaved in the DOM after the streaming bubble, the wrong group was
 * removed.
 *
 * The fix targets the specific message group by [data-message-id] so only the
 * finished message's bubble is replaced by loadMessages().
 *
 * This test:
 *   1. Seeds the streaming message as the LAST store entry (the completion
 *      handler only fires when msgs[msgs.length - 1].isStreaming), then appends
 *      a "decoy" group AFTER the streaming target in the DOM, so the decoy is
 *      the last .mcx-msg-group in DOM order. Positional last-group removal
 *      would delete the decoy instead of the streaming target.
 *   2. Fires an is_complete=true WS frame referencing the streaming target id.
 *   3. Asserts the decoy group survives and msg_streaming is not duplicated.
 *      Both assertions verified RED against the positional bug: the decoy is
 *      removed AND msg_streaming is duplicated by the loadMessages() re-render.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./connection/init', () => ({
  fetchInitConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('./analytics/posthog', () => ({
  init: vi.fn(),
  capture: vi.fn(),
  __resetForTesting: vi.fn(),
}));

vi.mock('./connection/api-client', () => ({
  validateSession: vi.fn().mockResolvedValue('valid'),
  createVisitor: vi.fn().mockResolvedValue({ id: 'v_test', name: 'Test' }),
}));

// Capture the WS onMessage handler so the test can fire frames.
let capturedOnMessage: ((data: Record<string, unknown>) => void) | null = null;
vi.mock('./connection/websocket-manager', () => ({
  WebSocketManager: vi.fn().mockImplementation(
    (_config: unknown, onMessage: (data: Record<string, unknown>) => void) => {
      capturedOnMessage = onMessage;
      return {
        connected: false,
        readyState: 1,
        connect: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      };
    },
  ),
}));

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

// ── Fixture ───────────────────────────────────────────────────────────────────

window.MemoxChatConfig = {
  embedId: undefined,
  leadCapture: false,
} as unknown as typeof window.MemoxChatConfig;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('is_complete re-render — data-message-id targeted removal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedOnMessage = null;

    // Seed a session where the streaming bot message is the LAST store entry:
    // the completion handler gates on msgs[msgs.length - 1].isStreaming. An
    // older first message keeps renderedCount above zero after the targeted
    // removal decrement, so loadMessages() takes the incremental path (the
    // renderedCount === 0 branch wipes messagesEl.innerHTML, which would
    // delete the decoy regardless of implementation). The decoy itself is
    // appended directly to the DOM in the test body, AFTER the streaming
    // group, so the decoy is the last .mcx-msg-group in DOM order while the
    // streaming message stays last in the store.
    localStorage.setItem(
      'simple-chat-session',
      JSON.stringify({
        chatID: 'room-is-complete-test',
        timestamp: new Date().toISOString(),
        visitorInfo: { id: 'v1', name: 'Test' },
      }),
    );
    localStorage.setItem(
      'simple-chat-messages',
      JSON.stringify([
        {
          text: 'Earlier bot response',
          sender: 'bot',
          isWelcomeMessage: false,
          messageId: 'msg_first',
          created_at: '12:00',
        },
        {
          text: 'Streaming content so far',
          sender: 'bot',
          isWelcomeMessage: false,
          isStreaming: true,
          messageId: 'msg_streaming',
          created_at: '12:01',
          lastChunkTime: Date.now(),
        },
      ]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('#memox-chat-embed-host').forEach((el) => el.remove());
    localStorage.clear();
    vi.resetModules();
  });

  it('removes only the streaming target group, not the decoy, on is_complete with components', async () => {
    const indexModule = await import('./index');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedOnMessage, 'WS onMessage should be captured').toBeTruthy();
    if (!capturedOnMessage) return;

    const host = document.querySelector('#memox-chat-embed-host') as HTMLElement;
    const root = host.shadowRoot as ShadowRoot;

    // Wait for the initial loadMessages() render.
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    const messagesEl = root.querySelector('.mcx-messages') as HTMLElement | null;
    expect(messagesEl, 'messages container should exist').toBeTruthy();
    if (!messagesEl) return;

    // The streaming group must be rendered before we plant the decoy.
    expect(
      messagesEl.querySelector('[data-message-id="msg_streaming"]'),
      'streaming group should be rendered initially',
    ).toBeTruthy();

    // Plant the decoy: a message group appended AFTER the streaming target in
    // DOM order (e.g. an interleaved group rendered between chunk and
    // completion). Positional last-group removal would delete THIS element.
    const decoy = document.createElement('div');
    decoy.className = 'mcx-msg-group';
    decoy.setAttribute('data-message-id', 'msg_decoy');
    decoy.textContent = 'Interleaved group (decoy)';
    messagesEl.appendChild(decoy);

    // Send is_complete with a component attached — this triggers the targeted
    // group replacement path in index.ts.
    capturedOnMessage({
      message_type: 'message',
      sender_type: 'ai',
      is_complete: true,
      content: '',
      message_id: 'msg_streaming',
      components: [{ id: 'comp_1', type: 'shopify.product_card', version: 1, data: {} }],
    });

    // Allow loadMessages() to run after the re-render.
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    // The decoy group must still be present. Under positional last-group
    // removal the decoy (last in DOM) is deleted and this fails.
    const decoyEl = messagesEl.querySelector('[data-message-id="msg_decoy"]');
    expect(decoyEl, 'decoy group must survive the is_complete re-render').toBeTruthy();

    // The streaming group must be replaced, not duplicated. Under positional
    // removal the original streaming bubble is never removed, so the
    // loadMessages() re-render produces a second msg_streaming group.
    const streamingGroups = messagesEl.querySelectorAll('[data-message-id="msg_streaming"]');
    expect(
      streamingGroups.length,
      'exactly one msg_streaming group after targeted replacement',
    ).toBe(1);

    void indexModule;
  });
});
