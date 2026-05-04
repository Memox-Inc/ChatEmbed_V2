/**
 * Launcher rendering tests.
 *
 * The actual exported API is ``createLauncher(config, onClick)`` (see
 * ``src/ui/launcher.ts``). The plan body referenced a hypothetical
 * ``renderLauncher`` shape — per the plan's **Files** section, the real
 * launcher signature is the source of truth, so we test that.
 */
import { describe, expect, it, vi } from 'vitest';
import { createLauncher } from './launcher';
import type { ChatEmbedConfig } from '../config/types';

describe('createLauncher', () => {
  it('renders pill form factor with text', () => {
    const config: ChatEmbedConfig = {
      launcher: {
        form_factor: 'pill',
        pill_text: 'Chat with us',
        icon_type: 'bubble',
      },
    };

    const el = createLauncher(config, vi.fn());
    expect(el.classList.contains('mcx-launcher--pill')).toBe(true);
    const textEl = el.querySelector('.mcx-launcher-pill-text');
    expect(textEl?.textContent).toBe('Chat with us');
  });

  it('falls back to "Chat" when pill_text is empty', () => {
    const config: ChatEmbedConfig = {
      launcher: { form_factor: 'pill', pill_text: '', icon_type: 'bubble' },
    };
    const el = createLauncher(config, vi.fn());
    expect(el.querySelector('.mcx-launcher-pill-text')?.textContent).toBe('Chat');
  });

  it('escapes pill_text to prevent injection', () => {
    const config: ChatEmbedConfig = {
      launcher: {
        form_factor: 'pill',
        pill_text: '<img src=x onerror=alert(1)>',
        icon_type: 'bubble',
      },
    };
    const el = createLauncher(config, vi.fn());
    // textContent reads the raw text; the rendered DOM should not contain
    // an actual <img> element.
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.mcx-launcher-pill-text')?.textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });

  it('renders round form factor by default', () => {
    const config: ChatEmbedConfig = {};
    const el = createLauncher(config, vi.fn());
    expect(el.classList.contains('mcx-launcher--pill')).toBe(false);
    expect(el.classList.contains('mcx-launcher')).toBe(true);
  });

  it('renders round form factor when explicitly requested', () => {
    const config: ChatEmbedConfig = {
      launcher: { form_factor: 'round', icon_type: 'bubble' },
    };
    const el = createLauncher(config, vi.fn());
    expect(el.classList.contains('mcx-launcher--pill')).toBe(false);
  });

  it('still includes the chat-bubble icon in pill mode', () => {
    const config: ChatEmbedConfig = {
      launcher: { form_factor: 'pill', icon_type: 'bubble', pill_text: 'Talk to us' },
    };
    const el = createLauncher(config, vi.fn());
    expect(el.querySelector('svg.mcx-launcher-icon')).toBeTruthy();
  });

  it('invokes onClick when clicked', () => {
    const onClick = vi.fn();
    const el = createLauncher({}, onClick);
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
