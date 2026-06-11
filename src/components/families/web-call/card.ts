/**
 * Web call card renderer (MMX-468, Task 9).
 *
 * render(data, ctx) takes ONE raw WebCallData payload, exactly as
 * message-integration.ts calls it (mod.render(component.data, ctx)).
 *
 * CONTRACT (immutable):
 *   dispatch action_type = "web_call.start"
 *   payload = {}
 *   action response = { session_token, ws_url, max_duration_seconds }
 *
 * Lifecycle states (driven by component_update events + local call state):
 *   idle       -> Start voice call CTA
 *   connecting -> Spinner + "Connecting..." label
 *   live       -> Live dot, elapsed timer, equalizer bars, mute + end buttons
 *   ended      -> Summary card with formatted duration + "Start new call"
 *   error      -> Amber notice with error message
 *
 * Audio I/O is lazy: the call-controller bundle (dist/chat-voice.js) is
 * dynamically imported at call-start time only. This keeps the core bundle
 * free of AudioWorklet / WebSocket audio code. The browser dynamically
 * fetches the voice bundle from the same CDN origin as the core bundle.
 *
 * All colors from ctx.theme. Zero hex literals.
 * All DOM via el()/svg()/text() from core/dom.ts. No innerHTML with data.
 *
 * DEAD UNTIL TASK 10: component_update events are currently a NO-OP for
 * this component. Nothing sets _ctx on the rendered element yet, so the
 * guard in update() returns early. Task 10 must set _ctx during render
 * wiring to bring live updates to life. Grep for "DEAD UNTIL TASK 10"
 * to find every module with this constraint.
 */

import type { ComponentModule, RenderCtx, WebCallData } from '../../core/types';
import { el, svg, text } from '../../core/dom';

// ---- Voice bundle URL derivation (evaluated once at module load) -------------

/**
 * Derive the voice bundle URL from the embed script tag at load time.
 * Falls back to same-origin /dist/chat-voice.js for local dev.
 */
function getVoiceBundleUrl(): string {
  try {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const embedScript = scripts.find((s) => (s as HTMLScriptElement).src.includes('chat-embed'));
    if (embedScript) {
      return (embedScript as HTMLScriptElement).src.replace('chat-embed.js', 'chat-voice.js');
    }
  } catch { /* ignore */ }
  return '/dist/chat-voice.js';
}

const voiceBundleUrl = getVoiceBundleUrl();

// ---- Timer WeakMap -----------------------------------------------------------

// Stores the setInterval ref for the live-state elapsed timer, keyed by the
// root element so there are no memory leaks when the element is removed.
const timerMap = new WeakMap<HTMLElement, ReturnType<typeof setInterval>>();

// Stores the active CallController instance keyed by root element.
// Type is `unknown` here (the real type lives in the lazily-loaded voice bundle).
const controllerMap = new WeakMap<HTMLElement, { end(): void; toggleMute(): boolean; isMuted(): boolean }>();

// Stores the RenderCtx for each rendered root element so that update() can
// re-render without needing _ctx to be wired by Task 10 (tests also benefit).
const ctxMap = new WeakMap<HTMLElement, RenderCtx>();

// ---- SVG icons ---------------------------------------------------------------

function phoneIcon(): SVGSVGElement {
  return svg('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z' }),
  ]);
}

function micIcon(): SVGSVGElement {
  return svg('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z' }),
    svg('path', { d: 'M19 10v2a7 7 0 01-14 0v-2' }),
    svg('line', { x1: '12', y1: '19', x2: '12', y2: '23' }),
    svg('line', { x1: '8', y1: '23', x2: '16', y2: '23' }),
  ]);
}

function micOffIcon(): SVGSVGElement {
  return svg('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('line', { x1: '1', y1: '1', x2: '23', y2: '23' }),
    svg('path', { d: 'M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6' }),
    svg('path', { d: 'M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23' }),
    svg('line', { x1: '12', y1: '19', x2: '12', y2: '23' }),
    svg('line', { x1: '8', y1: '23', x2: '16', y2: '23' }),
  ]);
}

// ---- Helpers -----------------------------------------------------------------

/** Format seconds into mm:ss */
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60).toString();
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Format max_duration_seconds into a human-readable string (e.g. "10 min") */
function formatMaxDuration(seconds: number): string {
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)} min`;
  }
  return `${seconds} sec`;
}

// ---- State section builders --------------------------------------------------

function buildIdleSection(data: WebCallData, ctx: RenderCtx, root: HTMLElement): HTMLElement {
  const t = ctx.theme;
  const section = el('div', { 'data-part': 'idle-card' });
  section.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:20px 16px 16px;gap:12px;';

  // Icon area
  const iconWrap = el('div');
  iconWrap.style.cssText = `width:48px;height:48px;border-radius:50%;background:${t.primaryLight};display:flex;align-items:center;justify-content:center;color:${t.primary};`;
  iconWrap.appendChild(phoneIcon());
  section.appendChild(iconWrap);

  // Agent name
  const agentEl = el('div', {}, [text(data.agent_name)]);
  agentEl.style.cssText = `font-size:15px;font-weight:600;color:${t.text};text-align:center;`;
  section.appendChild(agentEl);

  // Max duration note
  const durationNote = el('div', {}, [text(`Up to ${formatMaxDuration(data.max_duration_seconds)}`)]);
  durationNote.style.cssText = `font-size:12px;color:${t.textMuted};text-align:center;`;
  section.appendChild(durationNote);

  // Start button
  const startBtn = el('button', { 'data-part': 'start-call-btn', type: 'button' });
  startBtn.style.cssText = `width:100%;padding:10px 16px;background:${t.primary};color:${t.surface};border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;`;
  const btnIcon = el('span');
  btnIcon.style.cssText = `display:flex;align-items:center;color:${t.surface};`;
  btnIcon.appendChild(phoneIcon());
  startBtn.appendChild(btnIcon);
  startBtn.appendChild(text('Start voice call'));
  section.appendChild(startBtn);

  // Mic permission hint
  const hint = el('div', { 'data-part': 'mic-hint' });
  hint.style.cssText = `display:flex;align-items:center;gap:4px;font-size:11px;color:${t.textMuted};`;
  const hintIcon = el('span');
  hintIcon.style.cssText = `display:flex;align-items:center;color:${t.textMuted};`;
  hintIcon.appendChild(micIcon());
  hint.appendChild(hintIcon);
  hint.appendChild(text('Microphone access required'));
  section.appendChild(hint);

  // Start button click handler
  startBtn.addEventListener('click', () => {
    if (startBtn.disabled) return;
    startBtn.disabled = true;

    // Optimistic UI: show connecting immediately
    replaceSection(root, buildConnectingSection(ctx));

    ctx.dispatch({
      message_id: ctx.messageId ?? '',
      component_id: ctx.componentId ?? '',
      action_type: 'web_call.start',
      payload: {},
    }).then(async (result) => {
      if (!result.ok) {
        const msg = result.error?.message ?? 'Could not start call. Please try again.';
        replaceSection(root, buildErrorSection(msg, ctx));
        return;
      }

      // Hub returns session_token and ws_url in the action response.
      // The response is treated as a raw object because ActionResult does not
      // type-narrow the voice-call-specific fields.
      const raw = result as unknown as Record<string, unknown>;
      const sessionToken = raw['session_token'] as string | undefined;
      const wsUrl = raw['ws_url'] as string | undefined;

      if (!sessionToken || !wsUrl) {
        // Hub will send component_update with state:'connecting'/'live'.
        // If session info is missing, just wait for component_update.
        return;
      }

      // Lazy-load the voice bundle and start audio I/O.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const voiceModule = await import(/* @vite-ignore */ voiceBundleUrl) as any;
        const controller = await voiceModule.initCallController({
          wsUrl,
          sessionToken,
          onTranscript(_speaker: string, _text: string) {
            // Transcripts: could render into a transcript log area.
            // Currently a no-op; Task 10 may wire this up.
          },
          onStateChange(state: string, detail?: string) {
            if (state === 'live') {
              const liveStateData: WebCallData = {
                ...data,
                state: 'live',
                started_at: new Date().toISOString(),
                duration_seconds: 0,
              };
              const liveSection = buildLiveSection(liveStateData, ctx, root);
              replaceSection(root, liveSection);
              startTimer(root, liveStateData);
            } else if (state === 'ended') {
              stopTimer(root);
              const ctrl = controllerMap.get(root);
              const endedStateData: WebCallData = { ...data, state: 'ended', duration_seconds: 0 };
              replaceSection(root, buildEndedSection(endedStateData, ctx, root));
              if (ctrl) controllerMap.delete(root);
            } else if (state === 'error') {
              stopTimer(root);
              replaceSection(root, buildErrorSection(detail ?? 'Call error.', ctx));
              controllerMap.delete(root);
            }
          },
        });
        controllerMap.set(root, controller);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start call.';
        replaceSection(root, buildErrorSection(msg, ctx));
      }
    }).catch(() => {
      replaceSection(root, buildErrorSection('Could not connect. Please try again.', ctx));
    });
  });

  return section;
}

function buildConnectingSection(ctx: RenderCtx): HTMLElement {
  const t = ctx.theme;
  const section = el('div', { 'data-part': 'connecting-card' });
  section.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:24px 16px;gap:12px;';

  const spinner = el('div', { 'data-part': 'spinner' });
  spinner.style.cssText = [
    'width:36px',
    'height:36px',
    `border:3px solid ${t.border}`,
    `border-top-color:${t.primary}`,
    'border-radius:50%',
    'animation:mmx-spin 0.8s linear infinite',
  ].join(';');

  // Inject keyframes once
  injectSpinnerKeyframes();

  const label = el('div', {}, [text('Connecting...')]);
  label.style.cssText = `font-size:14px;color:${t.textMuted};`;

  section.appendChild(spinner);
  section.appendChild(label);
  return section;
}

function buildLiveSection(data: WebCallData, ctx: RenderCtx, root: HTMLElement): HTMLElement {
  const t = ctx.theme;
  const section = el('div', { 'data-part': 'live-card' });
  section.style.cssText = 'display:flex;flex-direction:column;padding:14px 16px;gap:12px;';

  // Live indicator row
  const liveRow = el('div');
  liveRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';

  const liveBadge = el('div');
  liveBadge.style.cssText = 'display:flex;align-items:center;gap:6px;';

  const liveDot = el('span', { 'data-part': 'live-dot' });
  liveDot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${t.success};display:inline-block;`;
  injectPulseKeyframes();
  liveDot.style.animation = 'mmx-pulse 1.5s ease-in-out infinite';

  const liveLabel = el('span', {}, [text('Live')]);
  liveLabel.style.cssText = `font-size:12px;font-weight:600;color:${t.success};text-transform:uppercase;letter-spacing:0.5px;`;

  liveBadge.appendChild(liveDot);
  liveBadge.appendChild(liveLabel);

  // Timer
  const timer = el('div', { 'data-part': 'live-timer' });
  const elapsed = data.duration_seconds ?? 0;
  timer.style.cssText = `font-size:16px;font-weight:700;color:${t.text};font-variant-numeric:tabular-nums;`;
  timer.textContent = formatDuration(elapsed);

  liveRow.appendChild(liveBadge);
  liveRow.appendChild(timer);
  section.appendChild(liveRow);

  // Agent name
  const agentEl = el('div', {}, [text(data.agent_name)]);
  agentEl.style.cssText = `font-size:13px;color:${t.textMuted};`;
  section.appendChild(agentEl);

  // Equalizer
  const equalizer = el('div', { 'data-part': 'equalizer' });
  equalizer.style.cssText = 'display:flex;align-items:flex-end;gap:3px;height:24px;';
  injectEqualizerKeyframes();
  const barHeights = [40, 70, 55, 85, 45, 65];
  for (let i = 0; i < 6; i++) {
    const bar = el('div', { 'data-part': 'eq-bar' });
    bar.style.cssText = [
      'width:4px',
      `background:${t.primary}`,
      'border-radius:2px',
      `height:${barHeights[i]}%`,
      `animation:mmx-eq${i + 1} ${0.5 + i * 0.12}s ease-in-out infinite alternate`,
    ].join(';');
    equalizer.appendChild(bar);
  }
  section.appendChild(equalizer);

  // Controls row
  const controls = el('div');
  controls.style.cssText = 'display:flex;gap:8px;';

  // Mute button
  const muteBtn = el('button', { 'data-part': 'mute-btn', type: 'button' });
  applySecondaryBtnStyles(muteBtn, t);
  const muteIconWrap = el('span');
  muteIconWrap.style.cssText = 'display:flex;align-items:center;';
  muteIconWrap.appendChild(micIcon());
  muteBtn.appendChild(muteIconWrap);
  muteBtn.appendChild(text('Mute'));

  muteBtn.addEventListener('click', () => {
    const ctrl = controllerMap.get(root);
    if (!ctrl) return;
    const nowMuted = ctrl.toggleMute();
    // Update button appearance
    while (muteBtn.firstChild) muteBtn.removeChild(muteBtn.firstChild);
    const newIconWrap = el('span');
    newIconWrap.style.cssText = 'display:flex;align-items:center;';
    newIconWrap.appendChild(nowMuted ? micOffIcon() : micIcon());
    muteBtn.appendChild(newIconWrap);
    muteBtn.appendChild(text(nowMuted ? 'Unmute' : 'Mute'));
    if (nowMuted) {
      muteBtn.style.background = t.surfaceSubtle;
      muteBtn.style.color = t.text;
    } else {
      applySecondaryBtnStyles(muteBtn, t);
    }
  });

  // End call button
  const endBtn = el('button', { 'data-part': 'end-call-btn', type: 'button' });
  endBtn.style.cssText = [
    'flex:1',
    'padding:9px 14px',
    `background:${t.error}`,
    `color:${t.surface}`,
    'border:none',
    'border-radius:8px',
    'font-size:13px',
    'font-weight:600',
    'cursor:pointer',
  ].join(';');
  endBtn.appendChild(text('End call'));

  endBtn.addEventListener('click', () => {
    const ctrl = controllerMap.get(root);
    if (ctrl) {
      ctrl.end();
      controllerMap.delete(root);
    }
    stopTimer(root);
    // Compute elapsed from the timer text content if available (best-effort)
    const timerEl = root.querySelector('[data-part="live-timer"]') as HTMLElement | null;
    let durationSec = data.duration_seconds ?? 0;
    if (timerEl && timerEl.textContent) {
      const parts = timerEl.textContent.split(':');
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const s = parseInt(parts[1], 10);
        if (!isNaN(m) && !isNaN(s)) durationSec = m * 60 + s;
      }
    }
    const endedStateData: WebCallData = { ...data, state: 'ended', duration_seconds: durationSec };
    replaceSection(root, buildEndedSection(endedStateData, ctx, root));
  });

  controls.appendChild(muteBtn);
  controls.appendChild(endBtn);
  section.appendChild(controls);

  return section;
}

function buildEndedSection(data: WebCallData, ctx: RenderCtx, root: HTMLElement): HTMLElement {
  const t = ctx.theme;
  const section = el('div', { 'data-part': 'call-ended' });
  section.style.cssText = `display:flex;flex-direction:column;align-items:center;padding:20px 16px 16px;gap:12px;background:${t.surfaceSubtle};`;

  const iconWrap = el('div');
  iconWrap.style.cssText = `width:44px;height:44px;border-radius:50%;background:${t.border};display:flex;align-items:center;justify-content:center;color:${t.textMuted};`;
  iconWrap.appendChild(phoneIcon());
  section.appendChild(iconWrap);

  const callEndedLabel = el('div', {}, [text('Call ended')]);
  callEndedLabel.style.cssText = `font-size:15px;font-weight:600;color:${t.text};`;
  section.appendChild(callEndedLabel);

  if (data.duration_seconds !== null) {
    const durationEl = el('div', {}, [text(formatDuration(data.duration_seconds))]);
    durationEl.style.cssText = `font-size:13px;color:${t.textMuted};font-variant-numeric:tabular-nums;`;
    section.appendChild(durationEl);
  }

  // Start new call button
  const newCallBtn = el('button', { 'data-part': 'new-call-btn', type: 'button' });
  newCallBtn.style.cssText = `padding:8px 20px;background:${t.surface};color:${t.primary};border:1.5px solid ${t.primary};border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;`;
  newCallBtn.appendChild(text('Start new call'));

  newCallBtn.addEventListener('click', () => {
    const freshData: WebCallData = { ...data, state: 'idle', started_at: null, duration_seconds: null, error: null };
    replaceSection(root, buildIdleSection(freshData, ctx, root));
  });

  section.appendChild(newCallBtn);
  return section;
}

function buildErrorSection(errorMsg: string, ctx: RenderCtx): HTMLElement {
  const t = ctx.theme;
  const section = el('div', { 'data-part': 'error-card' });
  section.style.cssText = `display:flex;flex-direction:column;padding:14px 16px;gap:8px;background:${t.errorSubtle};border-radius:8px;`;

  const errLabel = el('div', {}, [text('Could not start call')]);
  errLabel.style.cssText = `font-size:13px;font-weight:600;color:${t.error};`;
  section.appendChild(errLabel);

  const errMsg = el('div', {}, [text(errorMsg)]);
  errMsg.style.cssText = `font-size:12px;color:${t.error};`;
  section.appendChild(errMsg);

  return section;
}

// ---- Root element state management -------------------------------------------

/** Replace the content section of the card root */
function replaceSection(root: HTMLElement, newSection: HTMLElement): void {
  // The root has a header and a content area (second child onward).
  // We keep [data-part="card-header"] and replace everything else.
  const header = root.querySelector('[data-part="card-header"]');
  while (root.firstChild) root.removeChild(root.firstChild);
  if (header) root.appendChild(header);
  root.appendChild(newSection);
}

// ---- Timer helpers -----------------------------------------------------------

function startTimer(root: HTMLElement, data: WebCallData): void {
  stopTimer(root);
  let elapsed = data.duration_seconds ?? 0;
  const handle = setInterval(() => {
    elapsed += 1;
    const timerEl = root.querySelector('[data-part="live-timer"]') as HTMLElement | null;
    if (timerEl) {
      timerEl.textContent = formatDuration(elapsed);
    }
  }, 1000);
  timerMap.set(root, handle);
}

function stopTimer(root: HTMLElement): void {
  const handle = timerMap.get(root);
  if (handle !== undefined) {
    clearInterval(handle);
    timerMap.delete(root);
  }
}

// ---- CSS injection (once per document) --------------------------------------

let spinnerInjected = false;
function injectSpinnerKeyframes(): void {
  if (spinnerInjected) return;
  spinnerInjected = true;
  try {
    const style = document.createElement('style');
    style.textContent = '@keyframes mmx-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  } catch { /* ignore in SSR/jsdom */ }
}

let pulseInjected = false;
function injectPulseKeyframes(): void {
  if (pulseInjected) return;
  pulseInjected = true;
  try {
    const style = document.createElement('style');
    style.textContent = '@keyframes mmx-pulse{0%,100%{opacity:1}50%{opacity:0.4}}';
    document.head.appendChild(style);
  } catch { /* ignore */ }
}

let eqInjected = false;
function injectEqualizerKeyframes(): void {
  if (eqInjected) return;
  eqInjected = true;
  try {
    const style = document.createElement('style');
    const frames = [1, 2, 3, 4, 5, 6].map((i) =>
      `@keyframes mmx-eq${i}{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}`
    ).join('');
    style.textContent = frames;
    document.head.appendChild(style);
  } catch { /* ignore */ }
}

// ---- Style helpers -----------------------------------------------------------

function applySecondaryBtnStyles(btn: HTMLButtonElement, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'flex:1',
    'padding:9px 14px',
    `background:${t.surface}`,
    `color:${t.textMuted}`,
    `border:1px solid ${t.border}`,
    'border-radius:8px',
    'font-size:13px',
    'font-weight:500',
    'cursor:pointer',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:6px',
  ].join(';');
}

// ---- Root builder ------------------------------------------------------------

function buildCardHeader(data: WebCallData, ctx: RenderCtx): HTMLElement {
  const t = ctx.theme;
  const header = el('div', { 'data-part': 'card-header' });
  header.style.cssText = [
    `background:${t.primaryLight}`,
    `border-bottom:1px solid ${t.border}`,
    'padding:10px 14px',
    'display:flex',
    'align-items:center',
    'gap:8px',
  ].join(';');

  const iconWrap = el('span');
  iconWrap.style.cssText = `color:${t.primary};display:flex;align-items:center;`;
  iconWrap.appendChild(phoneIcon());

  const titleEl = el('span', {}, [text('Voice Call')]);
  titleEl.style.cssText = `font-size:13px;font-weight:600;color:${t.primary};`;

  header.appendChild(iconWrap);
  header.appendChild(titleEl);
  return header;
}

function renderWebCall(data: WebCallData, ctx: RenderCtx): HTMLElement {
  const t = ctx.theme;
  const root = el('div', { 'data-part': 'web-call-card' });
  // Store ctx so update() can re-render even before Task 10 sets _ctx.
  ctxMap.set(root, ctx);
  root.style.cssText = [
    `background:${t.surface}`,
    `border:1px solid ${t.border}`,
    'border-radius:10px',
    'overflow:hidden',
    'max-width:320px',
    'width:100%',
  ].join(';');

  root.appendChild(buildCardHeader(data, ctx));

  let contentSection: HTMLElement;
  switch (data.state) {
    case 'idle':
      contentSection = buildIdleSection(data, ctx, root);
      break;
    case 'connecting':
      contentSection = buildConnectingSection(ctx);
      break;
    case 'live':
      contentSection = buildLiveSection(data, ctx, root);
      startTimer(root, data);
      break;
    case 'ended':
      contentSection = buildEndedSection(data, ctx, root);
      break;
    case 'error':
      contentSection = buildErrorSection(data.error ?? 'Unknown error.', ctx);
      break;
  }

  root.appendChild(contentSection);
  return root;
}

// ---- Module export -----------------------------------------------------------

export const WebCallCardModule: ComponentModule = {
  version: 1,

  render(data: unknown, ctx: RenderCtx): HTMLElement {
    return renderWebCall(data as WebCallData, ctx);
  },

  /**
   * DEAD UNTIL TASK 10: component_update events are currently a NO-OP for
   * this component once _ctx wiring is in place. Before Task 10, this
   * module uses its own ctxMap WeakMap so that update() works in tests and
   * from the dispatcher without requiring _ctx to be stamped. Task 10 must
   * set _ctx during render wiring if other modules rely on that convention.
   * Grep for "DEAD UNTIL TASK 10" to find every module with this constraint.
   */
  update(rootEl: HTMLElement, data: unknown): void {
    // Prefer ctxMap (populated at render time), fall back to _ctx convention.
    const ctx = ctxMap.get(rootEl) ?? (rootEl as HTMLElement & { _ctx?: RenderCtx })._ctx;
    if (!ctx) return;

    const wcd = data as WebCallData;
    stopTimer(rootEl);
    controllerMap.delete(rootEl);

    const newSection = (() => {
      switch (wcd.state) {
        case 'idle':       return buildIdleSection(wcd, ctx, rootEl);
        case 'connecting': return buildConnectingSection(ctx);
        case 'live':       return buildLiveSection(wcd, ctx, rootEl);
        case 'ended':      return buildEndedSection(wcd, ctx, rootEl);
        case 'error':      return buildErrorSection(wcd.error ?? 'Unknown error.', ctx);
      }
    })();
    replaceSection(rootEl, newSection);
    if (wcd.state === 'live') startTimer(rootEl, wcd);
    // Update ctxMap entry so subsequent update() calls remain live.
    ctxMap.set(rootEl, ctx);
    // Mirror Task 10 convention.
    (rootEl as HTMLElement & { _ctx?: RenderCtx })._ctx = ctx;
  },
};
