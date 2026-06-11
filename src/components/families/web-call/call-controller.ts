/**
 * Call controller, audio I/O for BrowserVoiceConsumer (MMX-736 protocol).
 *
 * This file is the entry point for the SECOND Vite build pass and compiles
 * into dist/chat-voice.js (IIFE, separate from the core bundle). It is
 * loaded lazily via dynamic import in card.ts only when the user starts a
 * call, keeping AudioWorklet / WebSocket audio code out of the core bundle.
 *
 * Protocol (from hub origin/main browser_voice_consumer.py):
 *   Browser -> server: {"type":"audio","pcm":"<base64 16-bit LE 16kHz>"}
 *                      {"type":"end"}
 *   Server -> browser: {"type":"audio","pcm":"<base64 16-bit LE 24kHz>","sample_rate":24000}
 *                      {"type":"transcript","speaker":"user"|"agent","text":"..."}
 *                      {"type":"error","message":"..."}
 *
 * Audio capture uses an AudioWorklet (PCMFramer inlined as a string and
 * loaded via a blob URL) mirroring the merged mmx-unified-chat
 * useBrowserVoiceSession + pcm-downsampler.js pattern. PCMFramer converts
 * Float32 [-1,1] to Int16 LE and buffers frames of 320 samples (20 ms at
 * 16kHz) before posting them to the main thread.
 *
 * NOTE: AudioWorklet and navigator.mediaDevices are browser-only APIs.
 * This module cannot be tested with jsdom. Browser-only verification is
 * required (documented in the task report).
 */

export interface CallControllerOptions {
  wsUrl: string;
  sessionToken: string;
  onTranscript(speaker: 'user' | 'agent', text: string): void;
  onStateChange(state: 'connecting' | 'live' | 'ended' | 'error', detail?: string): void;
}

export interface CallController {
  end(): void;
  toggleMute(): boolean; // returns new muted state
  isMuted(): boolean;
}

/**
 * PCMFramer AudioWorklet source, inlined as a string and loaded via blob URL.
 * Mirrors repos/mmx-unified-chat public/audio-worklets/pcm-downsampler.js.
 *
 * Algorithm: Float32 [-1,1] -> Int16 LE, buffered into 320-sample (20 ms at
 * 16kHz) frames. Each full frame is posted to the main thread via
 * port.postMessage transferring ownership of the Int16Array buffer to
 * avoid a copy.
 */
const PCM_FRAMER_WORKLET = `
const FRAME_SAMPLES = 320;
class PCMFramer extends AudioWorkletProcessor {
  constructor() { super(); this._pending = new Int16Array(0); }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;
    const converted = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const s = channel[i];
      const c = s < -1 ? -1 : s > 1 ? 1 : s;
      converted[i] = Math.round(c * 0x7fff);
    }
    const all = new Int16Array(this._pending.length + converted.length);
    all.set(this._pending, 0);
    all.set(converted, this._pending.length);
    let off = 0;
    while (off + FRAME_SAMPLES <= all.length) {
      const frame = all.slice(off, off + FRAME_SAMPLES);
      this.port.postMessage(frame, [frame.buffer]);
      off += FRAME_SAMPLES;
    }
    this._pending = all.slice(off);
    return true;
  }
}
registerProcessor('pcm-framer', PCMFramer);
`;

export async function initCallController(opts: CallControllerOptions): Promise<CallController> {
  // 1. Open WebSocket to wsUrl?token=sessionToken
  const url = `${opts.wsUrl}${opts.wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(opts.sessionToken)}`;
  const ws = new WebSocket(url);

  // 2. Get microphone access
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    opts.onStateChange('error', 'Microphone access denied.');
    throw err;
  }

  // 3. AudioContext for capture (16kHz -> PCM base64) + playback (24kHz output).
  const captureCtx = new AudioContext({ sampleRate: 16000 });
  const playbackCtx = new AudioContext({ sampleRate: 24000 });
  const source = captureCtx.createMediaStreamSource(stream);
  let muted = false;
  let ended = false;

  // 4. Load PCMFramer via blob URL (keeps the bundle self-contained)
  const workletUrl = URL.createObjectURL(
    new Blob([PCM_FRAMER_WORKLET], { type: 'application/javascript' }),
  );
  try {
    await captureCtx.audioWorklet.addModule(workletUrl);
  } finally {
    URL.revokeObjectURL(workletUrl);
  }

  const workletNode = new AudioWorkletNode(captureCtx, 'pcm-framer');

  // 5. Pipe PCM frames to the WebSocket as base64-encoded JSON
  workletNode.port.onmessage = (e: MessageEvent<Int16Array>) => {
    if (muted || ended || ws.readyState !== WebSocket.OPEN) return;
    const bytes = new Uint8Array(e.data.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    ws.send(JSON.stringify({ type: 'audio', pcm: btoa(bin) }));
  };

  source.connect(workletNode);

  // 6. WebSocket event handlers
  ws.onopen = () => opts.onStateChange('live');

  ws.onmessage = (event) => {
    type ServerMsg =
      | { type: 'audio'; pcm: string; sample_rate?: number }
      | { type: 'transcript'; speaker: 'user' | 'agent'; text: string }
      | { type: 'error'; message: string };

    let msg: ServerMsg;
    try {
      msg = JSON.parse(event.data as string) as ServerMsg;
    } catch {
      return;
    }

    if (msg.type === 'audio' && msg.pcm) {
      // Decode base64 PCM (16-bit LE, 24kHz) and schedule for playback
      const binary = atob(msg.pcm);
      const buf = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
      const int16 = new Int16Array(buf);
      const audioBuffer = playbackCtx.createBuffer(1, int16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16.length; i++) channelData[i] = int16[i] / 32768;
      const bufSource = playbackCtx.createBufferSource();
      bufSource.buffer = audioBuffer;
      bufSource.connect(playbackCtx.destination);
      bufSource.start();
    } else if (msg.type === 'transcript') {
      opts.onTranscript(msg.speaker, msg.text);
    } else if (msg.type === 'error') {
      opts.onStateChange('error', msg.message);
    }
  };

  ws.onerror = () => opts.onStateChange('error', 'Connection error.');
  ws.onclose = () => {
    if (!ended) opts.onStateChange('ended');
  };

  // 7. Return controller
  return {
    end(): void {
      ended = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'end' }));
        ws.close();
      }
      stream.getTracks().forEach((t) => t.stop());
      workletNode.port.close();
      workletNode.disconnect();
      source.disconnect();
      void captureCtx.close();
      void playbackCtx.close();
      opts.onStateChange('ended');
    },

    toggleMute(): boolean {
      muted = !muted;
      stream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
      return muted;
    },

    isMuted(): boolean {
      return muted;
    },
  };
}
