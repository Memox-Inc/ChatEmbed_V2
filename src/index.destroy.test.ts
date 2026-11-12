/**
 * destroy() tears down live connections — MMX-928.
 *
 * Bug: `window.MemoxChatWidget.destroy()` removed listeners and the shadow
 * host but never closed the app WebSocket or stopped the embed-config
 * listener. The zombie instance kept receiving frames and wrote them into the
 * shared localStorage message array, so a freshly booted widget showed every
 * streamed token twice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wsClose = vi.fn();
const listenerStop = vi.fn();

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
  createVisitor: vi.fn().mockResolvedValue({ id: 'v_test', name: 'Test' }),
}));

vi.mock('./connection/websocket-manager', () => ({
  WebSocketManager: vi.fn().mockImplementation(() => ({
    connected: false,
    readyState: 1,
    connect: vi.fn(),
    send: vi.fn(),
    close: wsClose,
  })),
}));

vi.mock('./connection/embed-config-listener', () => ({
  startEmbedConfigListener: vi.fn().mockReturnValue({ stop: listenerStop }),
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

window.MemoxChatConfig = {
  embedId: 'emb_destroy_test',
  leadCapture: false,
} as unknown as typeof window.MemoxChatConfig;

describe('destroy() (MMX-928)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    wsClose.mockClear();
    listenerStop.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('#memox-chat-embed-host').forEach((el) => el.remove());
    localStorage.clear();
  });

  it('closes the app WebSocket and stops the embed-config listener', async () => {
    await import('./index');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);

    const widget = (window as unknown as { MemoxChatWidget?: { destroy: () => void } })
      .MemoxChatWidget;
    expect(widget, 'MemoxChatWidget is exposed after init').toBeTruthy();
    expect(wsClose).not.toHaveBeenCalled();
    expect(listenerStop).not.toHaveBeenCalled();

    widget!.destroy();

    expect(wsClose, 'app WebSocket closed').toHaveBeenCalledTimes(1);
    expect(listenerStop, 'embed-config listener stopped').toHaveBeenCalledTimes(1);
    expect(document.querySelector('#memox-chat-embed-host'), 'host removed').toBeNull();
  });
});
