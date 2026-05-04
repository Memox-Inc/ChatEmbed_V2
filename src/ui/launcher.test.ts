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

  describe('icon variants', () => {
    it('renders photo variant with image and indicator badge', () => {
      const config: ChatEmbedConfig = {
        launcher: {
          form_factor: 'round',
          icon_type: 'photo',
          photo_url: 'https://example.com/sarah.jpg',
        },
      };
      const el = createLauncher(config, vi.fn());
      expect(el.classList.contains('mcx-launcher--photo')).toBe(true);
      const img = el.querySelector('img.mcx-launcher-photo-img');
      expect(img).toBeTruthy();
      expect((img as HTMLImageElement).src).toBe('https://example.com/sarah.jpg');
      expect(el.querySelector('.mcx-launcher-photo-indicator')).toBeTruthy();
    });

    it('falls back to bubble when icon_type=photo but photo_url is missing', () => {
      const config: ChatEmbedConfig = {
        launcher: { form_factor: 'round', icon_type: 'photo', photo_url: null },
      };
      const el = createLauncher(config, vi.fn());
      expect(el.classList.contains('mcx-launcher--photo')).toBe(false);
      expect(el.querySelector('svg.mcx-launcher-icon')).toBeTruthy();
    });

    it('renders custom logo variant from custom_icon_url', () => {
      const config: ChatEmbedConfig = {
        launcher: {
          form_factor: 'round',
          icon_type: 'custom',
          custom_icon_url: 'https://example.com/logo.png',
        },
      };
      const el = createLauncher(config, vi.fn());
      const img = el.querySelector('img.mcx-launcher-custom-img');
      expect(img).toBeTruthy();
      expect((img as HTMLImageElement).src).toBe('https://example.com/logo.png');
    });

    it('falls back to bubble when icon_type=custom but custom_icon_url is missing', () => {
      const config: ChatEmbedConfig = {
        launcher: { form_factor: 'round', icon_type: 'custom', custom_icon_url: null },
      };
      const el = createLauncher(config, vi.fn());
      expect(el.querySelector('img.mcx-launcher-custom-img')).toBeNull();
      expect(el.querySelector('svg.mcx-launcher-icon')).toBeTruthy();
    });

    it('rejects javascript: scheme on photo_url', () => {
      const config: ChatEmbedConfig = {
        launcher: {
          form_factor: 'round',
          icon_type: 'photo',
          photo_url: 'javascript:alert(1)',
        },
      };
      const el = createLauncher(config, vi.fn());
      // Falls back to bubble — javascript: URLs are not http(s) or data:
      expect(el.querySelector('img.mcx-launcher-photo-img')).toBeNull();
      expect(el.querySelector('svg.mcx-launcher-icon')).toBeTruthy();
    });

    it('combines photo icon with pill form factor', () => {
      const config: ChatEmbedConfig = {
        launcher: {
          form_factor: 'pill',
          icon_type: 'photo',
          photo_url: 'https://example.com/sarah.jpg',
          pill_text: 'Talk to Sarah',
        },
      };
      const el = createLauncher(config, vi.fn());
      expect(el.classList.contains('mcx-launcher--pill')).toBe(true);
      expect(el.classList.contains('mcx-launcher--photo')).toBe(true);
      expect(el.querySelector('img.mcx-launcher-photo-img')).toBeTruthy();
      expect(el.querySelector('.mcx-launcher-pill-text')?.textContent).toBe('Talk to Sarah');
    });
  });

  describe('legacy config.customIcon security gate', () => {
    it('rejects raw HTML string in customIcon and falls through to bubble icon', () => {
      const config: ChatEmbedConfig = {
        customIcon: '<img src=x onerror=alert(1)>',
      };
      const el = createLauncher(config, vi.fn());
      // Must render the bubble SVG fallback
      expect(el.querySelector('svg.mcx-launcher-icon')).toBeTruthy();
      // Must NOT have rendered the injected img element
      const injected = el.querySelector('img[src="x"]');
      expect(injected).toBeNull();
    });

    it('accepts https customIcon URL with image extension', () => {
      const config: ChatEmbedConfig = {
        customIcon: 'https://example.com/logo.png',
      };
      const el = createLauncher(config, vi.fn());
      const img = el.querySelector('img.mcx-launcher-img') as HTMLImageElement | null;
      expect(img).toBeTruthy();
      expect(img?.src).toBe('https://example.com/logo.png');
    });

    it('accepts data:image/png customIcon', () => {
      const config: ChatEmbedConfig = {
        customIcon: 'data:image/png;base64,iVBORw0K',
      };
      const el = createLauncher(config, vi.fn());
      const img = el.querySelector('img.mcx-launcher-img') as HTMLImageElement | null;
      expect(img).toBeTruthy();
      expect(img?.src).toBe('data:image/png;base64,iVBORw0K');
    });

    it('rejects javascript: scheme in customIcon and falls through to bubble', () => {
      const config: ChatEmbedConfig = {
        customIcon: 'javascript:alert(1)',
      };
      const el = createLauncher(config, vi.fn());
      expect(el.querySelector('svg.mcx-launcher-icon')).toBeTruthy();
      expect(el.querySelector('img.mcx-launcher-img')).toBeNull();
    });

    it('rejects http URL without image extension and falls through to bubble', () => {
      const config: ChatEmbedConfig = {
        customIcon: 'https://example.com/page',
      };
      const el = createLauncher(config, vi.fn());
      expect(el.querySelector('svg.mcx-launcher-icon')).toBeTruthy();
      expect(el.querySelector('img.mcx-launcher-img')).toBeNull();
    });
  });
});
