/**
 * Smart auto-open attractor.
 *
 * Four invariants — all must hold for auto-open to fire:
 *   1. time_seconds elapsed since the widget mounted
 *   2. scroll_percent reached on the page
 *   3. user has NOT clicked the launcher manually
 *   4. sessionStorage `mcx_auto_opened` flag is absent
 *
 * Once it fires it sets the flag and unhooks listeners — no second fire
 * within the tab session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSmartAutoOpen } from './smart-auto-open';
import type { ChatEmbedConfig } from '../../config/types';

const STORAGE_KEY = 'mcx_auto_opened';

function makeConfig(
  overrides: Partial<NonNullable<NonNullable<ChatEmbedConfig['launcher']>['attractors']>['smart_auto_open']> = {},
): ChatEmbedConfig {
  return {
    launcher: {
      form_factor: 'round',
      icon_type: 'bubble',
      attractors: {
        smart_auto_open: {
          enabled: true,
          time_seconds: 1,
          scroll_percent: 30,
          ...overrides,
        },
      },
    },
  };
}

function setScrollable(scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: clientHeight,
    configurable: true,
  });
}

function setScrollY(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
}

describe('mountSmartAutoOpen', () => {
  let openChat: ReturnType<typeof vi.fn>;
  let onAutoOpen: ReturnType<typeof vi.fn>;
  // Track every handle from mountSmartAutoOpen so afterEach can detach
  // its scroll listener; jsdom doesn't reset window between tests in
  // the same file, so leaked listeners would fire each other's tryFire.
  let handles: Array<{ cleanup: () => void }>;

  function mount(...args: Parameters<typeof mountSmartAutoOpen>) {
    const handle = mountSmartAutoOpen(...args);
    handles.push(handle);
    return handle;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    setScrollable(3000, 800);
    setScrollY(0);
    openChat = vi.fn();
    onAutoOpen = vi.fn();
    handles = [];
  });

  afterEach(() => {
    handles.forEach((h) => h.cleanup());
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('does not fire before time_seconds elapses, even if scroll threshold reached', () => {
    mount(makeConfig({ time_seconds: 5 }), openChat, onAutoOpen);
    setScrollY(2000); // 2000 / (3000-800) = 91% — well past 30%
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(2000);
    expect(openChat).not.toHaveBeenCalled();
  });

  it('does not fire when only the time threshold is met (no scroll)', () => {
    mount(makeConfig(), openChat, onAutoOpen);
    vi.advanceTimersByTime(2000);
    expect(openChat).not.toHaveBeenCalled();
  });

  it('fires when both thresholds are met', () => {
    mount(makeConfig(), openChat, onAutoOpen);
    vi.advanceTimersByTime(1500);
    setScrollY(1500); // ~68%, past 30%
    window.dispatchEvent(new Event('scroll'));
    expect(openChat).toHaveBeenCalledTimes(1);
    expect(onAutoOpen).toHaveBeenCalledTimes(1);
  });

  it('persists mcx_auto_opened in sessionStorage after firing', () => {
    mount(makeConfig(), openChat, onAutoOpen);
    vi.advanceTimersByTime(1500);
    setScrollY(1500);
    window.dispatchEvent(new Event('scroll'));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('does not fire when sessionStorage flag is already set', () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    mount(makeConfig(), openChat, onAutoOpen);
    vi.advanceTimersByTime(2000);
    setScrollY(1500);
    window.dispatchEvent(new Event('scroll'));
    expect(openChat).not.toHaveBeenCalled();
  });

  it('does not fire after notifyManualOpen() is called (manual click suppresses)', () => {
    const handle = mount(makeConfig(), openChat, onAutoOpen);
    handle.notifyManualOpen();
    vi.advanceTimersByTime(2000);
    setScrollY(1500);
    window.dispatchEvent(new Event('scroll'));
    expect(openChat).not.toHaveBeenCalled();
  });

  it('does not fire if disabled', () => {
    mount(makeConfig({ enabled: false }), openChat, onAutoOpen);
    vi.advanceTimersByTime(2000);
    setScrollY(1500);
    window.dispatchEvent(new Event('scroll'));
    expect(openChat).not.toHaveBeenCalled();
  });

  it('treats unscrollable pages as 100% scrolled (auto-fires after time alone)', () => {
    setScrollable(800, 800); // page fits in viewport
    mount(makeConfig(), openChat, onAutoOpen);
    vi.advanceTimersByTime(1500);
    expect(openChat).toHaveBeenCalledTimes(1);
  });

  it('only fires once even with repeated scroll events', () => {
    mount(makeConfig(), openChat, onAutoOpen);
    vi.advanceTimersByTime(1500);
    setScrollY(1500);
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    setScrollY(2500);
    window.dispatchEvent(new Event('scroll'));
    expect(openChat).toHaveBeenCalledTimes(1);
  });

  it('cleanup() cancels pending fire and removes scroll listener', () => {
    const handle = mount(makeConfig(), openChat, onAutoOpen);
    handle.cleanup();
    vi.advanceTimersByTime(2000);
    setScrollY(1500);
    window.dispatchEvent(new Event('scroll'));
    expect(openChat).not.toHaveBeenCalled();
  });

  it('defaults time_seconds=30 and scroll_percent=50 when unset', () => {
    const cfg: ChatEmbedConfig = {
      launcher: {
        form_factor: 'round',
        icon_type: 'bubble',
        attractors: { smart_auto_open: { enabled: true } },
      },
    };
    mount(cfg, openChat, onAutoOpen);
    setScrollY(900); // 900 / 2200 ≈ 41%, below 50%
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(35_000);
    expect(openChat).not.toHaveBeenCalled();
    setScrollY(1300); // 1300 / 2200 ≈ 59%, past 50%
    window.dispatchEvent(new Event('scroll'));
    expect(openChat).toHaveBeenCalledTimes(1);
  });
});
