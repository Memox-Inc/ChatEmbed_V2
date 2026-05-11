/**
 * Notification badge attractor — small "1" indicator on the launcher
 * implying an unread message. Round launchers get a red corner-dot;
 * pill launchers get an inline brand-colored chip beside the label.
 * Cleared on first chat open.
 */
import { describe, expect, it, vi } from 'vitest';
import { mountBadge } from './badge';
import { createLauncher } from '../launcher';
import type { ChatEmbedConfig } from '../../config/types';

describe('mountBadge', () => {
  it('appends a corner badge to the round launcher', () => {
    const cfg: ChatEmbedConfig = {
      launcher: { form_factor: 'round', icon_type: 'bubble', attractors: { badge: { enabled: true } } },
    };
    const launcher = createLauncher(cfg, vi.fn());
    mountBadge(launcher, cfg);
    const badge = launcher.querySelector('.mcx-badge');
    expect(badge).toBeTruthy();
    expect(badge?.classList.contains('mcx-badge--inline')).toBe(false);
    expect(badge?.textContent).toBe('1');
  });

  it('appends an inline badge to the pill launcher', () => {
    const cfg: ChatEmbedConfig = {
      launcher: {
        form_factor: 'pill',
        icon_type: 'bubble',
        pill_text: 'Chat',
        attractors: { badge: { enabled: true } },
      },
    };
    const launcher = createLauncher(cfg, vi.fn());
    mountBadge(launcher, cfg);
    const badge = launcher.querySelector('.mcx-badge--inline');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('1');
  });

  it('does not append a badge when badge.enabled=false', () => {
    const cfg: ChatEmbedConfig = {
      launcher: { form_factor: 'round', icon_type: 'bubble', attractors: { badge: { enabled: false } } },
    };
    const launcher = createLauncher(cfg, vi.fn());
    mountBadge(launcher, cfg);
    expect(launcher.querySelector('.mcx-badge')).toBeNull();
  });

  it('does not append when attractors config is missing', () => {
    const cfg: ChatEmbedConfig = { launcher: { form_factor: 'round', icon_type: 'bubble' } };
    const launcher = createLauncher(cfg, vi.fn());
    mountBadge(launcher, cfg);
    expect(launcher.querySelector('.mcx-badge')).toBeNull();
  });

  it('returns a clearBadge() that removes both round and inline badges', () => {
    const cfg: ChatEmbedConfig = {
      launcher: { form_factor: 'round', icon_type: 'bubble', attractors: { badge: { enabled: true } } },
    };
    const launcher = createLauncher(cfg, vi.fn());
    const handle = mountBadge(launcher, cfg);
    expect(launcher.querySelector('.mcx-badge')).toBeTruthy();
    handle.cleanup();
    expect(launcher.querySelector('.mcx-badge')).toBeNull();
  });

  it('clearBadge() is idempotent (calling twice does not throw)', () => {
    const cfg: ChatEmbedConfig = {
      launcher: { form_factor: 'round', icon_type: 'bubble', attractors: { badge: { enabled: true } } },
    };
    const launcher = createLauncher(cfg, vi.fn());
    const handle = mountBadge(launcher, cfg);
    handle.cleanup();
    expect(() => handle.cleanup()).not.toThrow();
  });

  it('returns a no-op when disabled (clear is safe to call)', () => {
    const cfg: ChatEmbedConfig = { launcher: { form_factor: 'round', icon_type: 'bubble' } };
    const launcher = createLauncher(cfg, vi.fn());
    const handle = mountBadge(launcher, cfg);
    expect(() => handle.cleanup()).not.toThrow();
  });
});
