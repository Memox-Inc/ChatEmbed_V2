/**
 * Teaser bubble attractor — small "Need help?" nudge that appears next
 * to the launcher after a delay. Tests cover the timing, dismiss button,
 * and cleanup. Suppression rules (pill form, persona attractor) are
 * tested in the orchestrator (index.ts) — see HARD-8.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatEmbedConfig } from '../../config/types';
import { mountTeaser } from './teaser';

function clearBody(): void {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
}

describe('mountTeaser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearBody();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function baseConfig(overrides: Partial<NonNullable<ChatEmbedConfig['launcher']>> = {}): ChatEmbedConfig {
    return {
      launcher: {
        form_factor: 'round',
        icon_type: 'bubble',
        attractors: {
          teaser: {
            enabled: true,
            text: 'Need help?',
            show_after_seconds: 1,
            dismissible: true,
          },
        },
        ...overrides,
      },
    };
  }

  it('does not render before show_after_seconds elapses', () => {
    mountTeaser(baseConfig(), document.body);
    expect(document.querySelector('.mcx-teaser')).toBeNull();
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.mcx-teaser')).toBeNull();
  });

  it('renders after show_after_seconds with the configured text', () => {
    mountTeaser(baseConfig(), document.body);
    vi.advanceTimersByTime(1500);
    const teaser = document.querySelector('.mcx-teaser');
    expect(teaser).toBeTruthy();
    expect(teaser?.querySelector('.mcx-teaser-text')?.textContent).toBe('Need help?');
  });

  it('escapes user-supplied teaser text', () => {
    const cfg = baseConfig({
      attractors: {
        teaser: {
          enabled: true,
          text: '<script>alert(1)</script>',
          show_after_seconds: 1,
          dismissible: true,
        },
      },
    });
    mountTeaser(cfg, document.body);
    vi.advanceTimersByTime(1500);
    expect(document.querySelectorAll('script').length).toBe(0);
    expect(document.querySelector('.mcx-teaser-text')?.textContent).toBe('<script>alert(1)</script>');
  });

  it('renders dismiss button when dismissible=true and removes on click', () => {
    mountTeaser(baseConfig(), document.body);
    vi.advanceTimersByTime(1500);
    const close = document.querySelector('.mcx-teaser-close') as HTMLButtonElement;
    expect(close).toBeTruthy();
    close.click();
    expect(document.querySelector('.mcx-teaser')).toBeNull();
  });

  it('omits dismiss button when dismissible=false', () => {
    const cfg = baseConfig({
      attractors: {
        teaser: { enabled: true, text: 'Hi', show_after_seconds: 1, dismissible: false },
      },
    });
    mountTeaser(cfg, document.body);
    vi.advanceTimersByTime(1500);
    expect(document.querySelector('.mcx-teaser-close')).toBeNull();
  });

  it('does not render when teaser.enabled=false', () => {
    const cfg = baseConfig({
      attractors: { teaser: { enabled: false, text: 'Hi', show_after_seconds: 1 } },
    });
    mountTeaser(cfg, document.body);
    vi.advanceTimersByTime(5000);
    expect(document.querySelector('.mcx-teaser')).toBeNull();
  });

  it('does not render when text is missing', () => {
    const cfg = baseConfig({
      attractors: { teaser: { enabled: true, text: '', show_after_seconds: 1 } },
    });
    mountTeaser(cfg, document.body);
    vi.advanceTimersByTime(5000);
    expect(document.querySelector('.mcx-teaser')).toBeNull();
  });

  it('cleanup() cancels a pending timer before render', () => {
    const handle = mountTeaser(baseConfig(), document.body);
    handle.cleanup();
    vi.advanceTimersByTime(5000);
    expect(document.querySelector('.mcx-teaser')).toBeNull();
  });

  it('cleanup() removes a teaser already rendered', () => {
    const handle = mountTeaser(baseConfig(), document.body);
    vi.advanceTimersByTime(1500);
    expect(document.querySelector('.mcx-teaser')).toBeTruthy();
    handle.cleanup();
    expect(document.querySelector('.mcx-teaser')).toBeNull();
  });

  it('defaults show_after_seconds to 5 when unset', () => {
    const cfg = baseConfig({
      attractors: { teaser: { enabled: true, text: 'Hi', dismissible: true } },
    });
    mountTeaser(cfg, document.body);
    vi.advanceTimersByTime(4500);
    expect(document.querySelector('.mcx-teaser')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.mcx-teaser')).toBeTruthy();
  });
});
