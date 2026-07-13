import { describe, it, expect, vi } from 'vitest';
import { WebCallCardModule } from './card';
import type { WebCallData, RenderCtx, ThemeTokens } from '../../core/types';

const theme: ThemeTokens = {
  primary: '#8349ff', primaryLight: '#f0ebff', text: '#072032',
  textMuted: '#5b6b7a', border: '#e5e7eb', surface: '#fff',
  surfaceSubtle: '#f9fafb', error: '#ef4444', errorSubtle: '#fee2e2',
  success: '#22c55e', successSubtle: '#dcfce7', warning: '#d97706', warningSubtle: '#fffbeb',
};

function makeCtx(overrides: Partial<RenderCtx> = {}): RenderCtx {
  return {
    dispatch: vi.fn().mockResolvedValue({ ok: true }),
    theme, visitorTimezone: 'UTC', distinctId: 'id',
    enabled: { shopify: true, calendar: true, web_call: true },
    formatTime: (iso) => iso, formatDate: () => ({ weekday: 'Mon', day: '10' }),
    ...overrides,
  };
}

const idleData: WebCallData = {
  state: 'idle', agent_name: 'ContainerOne Assistant',
  max_duration_seconds: 600, started_at: null, duration_seconds: null, error: null,
};

const liveData: WebCallData = {
  state: 'live', agent_name: 'ContainerOne Assistant',
  max_duration_seconds: 600, started_at: '2026-06-11T14:05:00Z',
  duration_seconds: 45, error: null,
};

const endedData: WebCallData = {
  state: 'ended', agent_name: 'ContainerOne Assistant',
  max_duration_seconds: 600, started_at: '2026-06-11T14:05:00Z',
  duration_seconds: 180, error: null,
};

describe('WebCallCardModule', () => {
  it('renders idle state with Start voice call button', () => {
    const el = WebCallCardModule.render(idleData, makeCtx());
    const btn = el.querySelector('[data-part="start-call-btn"]');
    expect(btn).not.toBeNull();
  });

  it('shows max duration note in idle state', () => {
    const el = WebCallCardModule.render(idleData, makeCtx());
    expect(el.textContent).toContain('10 min');
  });

  it('dispatches web_call.start on button click', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      components: [{ id: 'cmp_wc', type: 'web_call', version: 1, data: { state: 'connecting', agent_name: 'Asst', max_duration_seconds: 600, started_at: null, duration_seconds: null, error: null } }],
    });
    const el = WebCallCardModule.render(idleData, makeCtx({ dispatch }));
    (el.querySelector('[data-part="start-call-btn"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ action_type: 'web_call.start' }));
  });

  it('shows live state with timer and equalizer bars', () => {
    const el = WebCallCardModule.render(liveData, makeCtx());
    expect(el.querySelector('[data-part="live-timer"]')).not.toBeNull();
    expect(el.querySelector('[data-part="equalizer"]')).not.toBeNull();
    expect(el.querySelector('[data-part="end-call-btn"]')).not.toBeNull();
  });

  it('update() transitions from idle to live without full re-render', () => {
    const el = WebCallCardModule.render(idleData, makeCtx());
    WebCallCardModule.update!(el, liveData);
    expect(el.querySelector('[data-part="live-timer"]')).not.toBeNull();
    expect(el.querySelector('[data-part="start-call-btn"]')).toBeNull();
  });

  it('shows ended state with duration', () => {
    const el = WebCallCardModule.render(endedData, makeCtx());
    expect(el.querySelector('[data-part="call-ended"]')).not.toBeNull();
    expect(el.textContent).toContain('3:00');
  });

  it('shows error state with message', () => {
    const errorData: WebCallData = { ...idleData, state: 'error', error: 'Microphone unavailable' };
    const el = WebCallCardModule.render(errorData, makeCtx());
    expect(el.textContent).toContain('Microphone unavailable');
  });
});

describe('WebCallCardModule client-side hard stop', () => {
  it('hard-stops a live call after max_duration_seconds + 10s grace', () => {
    vi.useFakeTimers();
    try {
      const el = WebCallCardModule.render(liveData, makeCtx());
      expect(el.querySelector('[data-part="live-card"]')).not.toBeNull();
      vi.advanceTimersByTime((liveData.max_duration_seconds + 10) * 1000 + 1000);
      expect(el.querySelector('[data-part="call-ended"]')).not.toBeNull();
      expect(el.querySelector('[data-part="live-card"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not fire the hard stop before the cap', () => {
    vi.useFakeTimers();
    try {
      const el = WebCallCardModule.render(liveData, makeCtx());
      vi.advanceTimersByTime(liveData.max_duration_seconds * 1000);
      expect(el.querySelector('[data-part="live-card"]')).not.toBeNull();
      expect(el.querySelector('[data-part="call-ended"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the hard stop on a server-pushed terminal update', () => {
    vi.useFakeTimers();
    try {
      const el = WebCallCardModule.render(liveData, makeCtx());
      WebCallCardModule.update!(el, endedData);
      // Both the elapsed-timer interval and the hard-stop timeout must be gone.
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime((liveData.max_duration_seconds + 10) * 1000 + 1000);
      expect(el.querySelector('[data-part="call-ended"]')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-arms the hard stop when a server-pushed update enters live', () => {
    vi.useFakeTimers();
    try {
      const el = WebCallCardModule.render(idleData, makeCtx());
      WebCallCardModule.update!(el, liveData);
      vi.advanceTimersByTime((liveData.max_duration_seconds + 10) * 1000 + 1000);
      expect(el.querySelector('[data-part="call-ended"]')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
