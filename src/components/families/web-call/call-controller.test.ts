/**
 * Scheme-guard tests for the voice call-controller (plan addendum).
 *
 * Mic audio must never stream to an arbitrary-scheme endpoint: the
 * controller requires wss://, allowing ws://localhost and ws://127.0.0.1
 * for development only.
 *
 * The full audio path (AudioWorklet, getUserMedia) is browser-only; these
 * tests mock WebSocket / AudioContext / mediaDevices to verify the guard
 * and the happy-path construction order, not real audio I/O.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { assertSecureWsUrl, initCallController } from './call-controller';
import type { CallControllerOptions } from './call-controller';

function makeOpts(wsUrl: string): CallControllerOptions {
  return {
    wsUrl,
    sessionToken: 'tok-123',
    onTranscript: () => {},
    onStateChange: () => {},
  };
}

describe('assertSecureWsUrl', () => {
  it('allows wss:// URLs', () => {
    expect(() => assertSecureWsUrl('wss://api.memox.io/ws/voice/browser/')).not.toThrow();
  });

  it('allows ws://localhost for development', () => {
    expect(() => assertSecureWsUrl('ws://localhost:8000/ws/voice/browser/')).not.toThrow();
  });

  it('allows ws://127.0.0.1 for development', () => {
    expect(() => assertSecureWsUrl('ws://127.0.0.1:8000/ws/voice/browser/')).not.toThrow();
  });

  it('rejects http:// URLs', () => {
    expect(() => assertSecureWsUrl('http://api.memox.io/ws/voice/')).toThrow(/wss/);
  });

  it('rejects https:// URLs', () => {
    expect(() => assertSecureWsUrl('https://api.memox.io/ws/voice/')).toThrow(/wss/);
  });

  it('rejects ws:// to non-localhost hosts', () => {
    expect(() => assertSecureWsUrl('ws://evil.example/ws/voice/')).toThrow(/wss/);
  });

  it('rejects ws://localhost.evil.com (not a real localhost)', () => {
    // "localhost.evil.com" is NOT localhost; the guard checks hostname
    // equality, not suffix matching, so this must be rejected.
    expect(() => assertSecureWsUrl('ws://localhost.evil.com/ws/voice/')).toThrow(/wss/);
  });

  it('rejects unparseable URLs', () => {
    expect(() => assertSecureWsUrl('not a url')).toThrow();
  });
});

describe('initCallController scheme guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects insecure ws:// URLs before constructing a WebSocket', async () => {
    const wsSpy = vi.fn();
    vi.stubGlobal('WebSocket', wsSpy);
    await expect(initCallController(makeOpts('ws://evil.example/ws/voice/'))).rejects.toThrow(/wss/);
    expect(wsSpy).not.toHaveBeenCalled();
  });

  it('rejects http:// URLs before constructing a WebSocket', async () => {
    const wsSpy = vi.fn();
    vi.stubGlobal('WebSocket', wsSpy);
    await expect(initCallController(makeOpts('http://api.memox.io/ws/voice/'))).rejects.toThrow(/wss/);
    expect(wsSpy).not.toHaveBeenCalled();
  });
});

describe('initCallController happy path (all browser APIs mocked)', () => {
  const constructedUrls: string[] = [];

  class FakeWS {
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((e: unknown) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    constructor(url: string) { constructedUrls.push(url); }
    send(): void {}
    close(): void {}
  }

  class FakeAudioContext {
    audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
    createMediaStreamSource(): { connect(): void; disconnect(): void } {
      return { connect: () => {}, disconnect: () => {} };
    }
    close(): Promise<void> { return Promise.resolve(); }
  }

  class FakeWorkletNode {
    port = { onmessage: null as unknown, close: (): void => {} };
    disconnect(): void {}
  }

  function installBrowserMocks(): () => void {
    const fakeTrack = { stop: vi.fn(), enabled: true };
    const fakeStream = {
      getTracks: () => [fakeTrack],
      getAudioTracks: () => [fakeTrack],
    };

    vi.stubGlobal('WebSocket', FakeWS);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    });

    const urlAny = URL as unknown as {
      createObjectURL?: (b: Blob) => string;
      revokeObjectURL?: (u: string) => void;
    };
    const origCreate = urlAny.createObjectURL;
    const origRevoke = urlAny.revokeObjectURL;
    urlAny.createObjectURL = () => 'blob:fake';
    urlAny.revokeObjectURL = () => {};

    return () => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, 'mediaDevices');
      urlAny.createObjectURL = origCreate;
      urlAny.revokeObjectURL = origRevoke;
      constructedUrls.length = 0;
    };
  }

  it('resolves a controller for wss:// URLs', async () => {
    const cleanup = installBrowserMocks();
    try {
      const controller = await initCallController(makeOpts('wss://api.memox.io/ws/voice/browser/'));
      expect(typeof controller.end).toBe('function');
      expect(typeof controller.toggleMute).toBe('function');
      expect(controller.isMuted()).toBe(false);
      expect(constructedUrls[0]).toContain('token=tok-123');
    } finally {
      cleanup();
    }
  });

  it('resolves a controller for ws://localhost URLs', async () => {
    const cleanup = installBrowserMocks();
    try {
      const controller = await initCallController(makeOpts('ws://localhost:8000/ws/voice/browser/'));
      expect(typeof controller.end).toBe('function');
    } finally {
      cleanup();
    }
  });

  it('end() is idempotent -- onStateChange("ended") fires exactly once even when called twice', async () => {
    const cleanup = installBrowserMocks();
    try {
      const stateChanges: string[] = [];
      const controller = await initCallController({
        wsUrl: 'wss://api.memox.io/ws/voice/browser/',
        sessionToken: 'tok-idempotent',
        onTranscript: () => {},
        onStateChange: (state) => { stateChanges.push(state); },
      });

      controller.end();
      controller.end(); // second call must be a no-op

      // Only one 'ended' transition may be emitted.
      expect(stateChanges.filter((s) => s === 'ended')).toHaveLength(1);
    } finally {
      cleanup();
    }
  });
});
