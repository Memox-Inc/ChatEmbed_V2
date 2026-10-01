import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatEmbedConfig, VisitorInfo } from '../config/types';
import { WebSocketManager } from './websocket-manager';

// MMX-239 — `visitor_info` was JSON.stringify'd straight into the query string
// while `browser_metadata`, immediately beside it, was wrapped in
// encodeURIComponent. Two consequences: an "&" in a visitor's name split the
// query string, and a literal "%" was mangled before the server ever saw it.
//
// The hub already decodes this param with urllib.parse.unquote
// (chat_app/services/app_websocket_service.py), so encoding it on the client is
// the symmetric half of the fix — no backend change is involved.

const CONFIG = {
  socketUrl: 'wss://hub.memox.io',
  org_id: 7,
} as unknown as ChatEmbedConfig;

function connectWith(visitorInfo: VisitorInfo) {
  const urls: string[] = [];

  class CapturingWebSocket {
    constructor(url: string) {
      urls.push(url);
    }
    close() {}
    send() {}
    addEventListener() {}
  }

  vi.stubGlobal('WebSocket', CapturingWebSocket as unknown as typeof WebSocket);

  const manager = new WebSocketManager(CONFIG, () => {});
  manager.connect(visitorInfo, 'chat-1');

  return urls;
}

/**
 * Read the param back the way the server does: split the query string, decode
 * once with unquote(), then parse. `URLSearchParams.get` performs exactly that
 * single decode, so it must not be decoded again here.
 */
function readVisitorInfo(url: string): unknown {
  return JSON.parse(new URL(url).searchParams.get('visitor_info') ?? '');
}

describe('WebSocketManager — visitor_info is percent-encoded (MMX-239)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('encodes an ampersand so it cannot split the query string', () => {
    const urls = connectWith({ id: 1, name: 'Tom & Jerry' });

    expect(readVisitorInfo(urls[0])).toEqual({ id: 1, name: 'Tom & Jerry' });
  });

  it('encodes a percent sign so it survives the round trip intact', () => {
    const urls = connectWith({ id: 1, name: '50%20off' });

    expect(readVisitorInfo(urls[0])).toEqual({ id: 1, name: '50%20off' });
  });

  it('still sends a plain visitor through unchanged', () => {
    const urls = connectWith({ id: 1, name: 'Jane Doe' });

    expect(readVisitorInfo(urls[0])).toEqual({ id: 1, name: 'Jane Doe' });
  });
});
