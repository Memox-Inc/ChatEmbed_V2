/**
 * Persona card attractor — name + message + photo/initials + optional
 * quick-question chips. Renders all user content via textContent so
 * server-supplied strings can't inject HTML.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPersonaCard } from './persona-card';
import type { ChatEmbedConfig } from '../../config/types';

function clearBody(): void {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
}

function makeConfig(overrides: Partial<ChatEmbedConfig> = {}): ChatEmbedConfig {
  return {
    launcher: {
      form_factor: 'round',
      icon_type: 'bubble',
      photo_url: 'https://example.com/sarah.jpg',
      attractors: {
        persona: {
          enabled: true,
          name: 'Sarah',
          message: 'Got 30 seconds?',
          show_chips: false,
        },
      },
    },
    ...overrides,
  };
}

describe('mountPersonaCard', () => {
  beforeEach(() => clearBody());
  afterEach(() => clearBody());

  it('does not render when persona.enabled=false', () => {
    const cfg = makeConfig({
      launcher: {
        ...makeConfig().launcher,
        attractors: { persona: { enabled: false, name: 'Sarah', message: 'Hi' } },
      },
    });
    mountPersonaCard(cfg, document.body, {});
    expect(document.querySelector('.mcx-persona-card')).toBeNull();
  });

  it('does not render when name or message is missing', () => {
    const cfg = makeConfig({
      launcher: {
        ...makeConfig().launcher,
        attractors: { persona: { enabled: true, name: '', message: 'Hi' } },
      },
    });
    mountPersonaCard(cfg, document.body, {});
    expect(document.querySelector('.mcx-persona-card')).toBeNull();
  });

  it('renders name and message via textContent', () => {
    mountPersonaCard(makeConfig(), document.body, {});
    expect(document.querySelector('.mcx-persona-name')?.textContent).toBe('Sarah');
    expect(document.querySelector('.mcx-persona-msg')?.textContent).toBe('Got 30 seconds?');
  });

  it('renders photo when launcher.photo_url is set', () => {
    mountPersonaCard(makeConfig(), document.body, {});
    const img = document.querySelector('img.mcx-persona-photo') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.src).toBe('https://example.com/sarah.jpg');
    expect(document.querySelector('.mcx-persona-initials')).toBeNull();
  });

  it('renders initials fallback when photo_url is missing', () => {
    const cfg = makeConfig({
      launcher: {
        ...makeConfig().launcher,
        photo_url: null,
        attractors: { persona: { enabled: true, name: 'Jane Marie Doe', message: 'Hi' } },
      },
    });
    mountPersonaCard(cfg, document.body, {});
    const initials = document.querySelector('.mcx-persona-initials');
    expect(initials).toBeTruthy();
    expect(initials?.textContent).toBe('JM');
  });

  it('escapes name and message (no script execution)', () => {
    const cfg = makeConfig({
      launcher: {
        ...makeConfig().launcher,
        attractors: {
          persona: {
            enabled: true,
            name: '<script>alert(1)</script>',
            message: '<img src=x onerror=alert(2)>',
          },
        },
      },
    });
    mountPersonaCard(cfg, document.body, {});
    expect(document.querySelectorAll('script').length).toBe(0);
    expect(document.querySelectorAll('.mcx-persona-card img').length).toBe(1); // only the photo
    expect(document.querySelector('.mcx-persona-name')?.textContent).toBe('<script>alert(1)</script>');
  });

  it('rejects javascript: photo URLs and falls back to initials', () => {
    const cfg = makeConfig({
      launcher: {
        ...makeConfig().launcher,
        photo_url: 'javascript:alert(1)',
      },
    });
    mountPersonaCard(cfg, document.body, {});
    expect(document.querySelector('img.mcx-persona-photo')).toBeNull();
    expect(document.querySelector('.mcx-persona-initials')?.textContent).toBe('S');
  });

  it('renders chips when show_chips=true and quickQuestions are configured', () => {
    const cfg = makeConfig({
      quickQuestions: ['What is your pricing?', 'How does it work?', 'Can I demo?', 'Extra ignored'],
      launcher: {
        ...makeConfig().launcher,
        attractors: {
          persona: { enabled: true, name: 'Sarah', message: 'Hi', show_chips: true },
        },
      },
    });
    mountPersonaCard(cfg, document.body, {});
    const chips = document.querySelectorAll('.mcx-persona-chip');
    expect(chips.length).toBe(3); // capped at 3
    expect(chips[0].textContent).toBe('What is your pricing?');
  });

  it('does not render chips when show_chips=false', () => {
    const cfg = makeConfig({
      quickQuestions: ['A', 'B'],
      launcher: {
        ...makeConfig().launcher,
        attractors: {
          persona: { enabled: true, name: 'Sarah', message: 'Hi', show_chips: false },
        },
      },
    });
    mountPersonaCard(cfg, document.body, {});
    expect(document.querySelector('.mcx-persona-chips')).toBeNull();
  });

  it('clicking a chip invokes onChipClick, opens chat, and removes the card', () => {
    const onOpen = vi.fn();
    const onChipClick = vi.fn();
    const cfg = makeConfig({
      quickQuestions: ['Pricing?'],
      launcher: {
        ...makeConfig().launcher,
        attractors: {
          persona: { enabled: true, name: 'Sarah', message: 'Hi', show_chips: true },
        },
      },
    });
    mountPersonaCard(cfg, document.body, { onOpen, onChipClick });
    (document.querySelector('.mcx-persona-chip') as HTMLButtonElement).click();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onChipClick).toHaveBeenCalledWith('Pricing?');
    expect(document.querySelector('.mcx-persona-card')).toBeNull();
  });

  it('clicking the dismiss button removes the card', () => {
    mountPersonaCard(makeConfig(), document.body, {});
    expect(document.querySelector('.mcx-persona-card')).toBeTruthy();
    (document.querySelector('.mcx-persona-close') as HTMLButtonElement).click();
    expect(document.querySelector('.mcx-persona-card')).toBeNull();
  });

  it('cleanup() removes the card', () => {
    const handle = mountPersonaCard(makeConfig(), document.body, {});
    expect(document.querySelector('.mcx-persona-card')).toBeTruthy();
    handle.cleanup();
    expect(document.querySelector('.mcx-persona-card')).toBeNull();
  });

  it('rejects data:image/svg+xml photo URL and falls back to initials', () => {
    const cfg = makeConfig({
      launcher: {
        ...makeConfig().launcher,
        photo_url: 'data:image/svg+xml;base64,PHN2Zy...',
      },
    });
    mountPersonaCard(cfg, document.body, {});
    // Must NOT render the photo image
    expect(document.querySelector('img.mcx-persona-photo')).toBeNull();
    // Must render initials instead
    expect(document.querySelector('.mcx-persona-initials')).toBeTruthy();
    expect(document.querySelector('.mcx-persona-initials')?.textContent).toBe('S');
  });

  it('accepts data:image/png photo URL', () => {
    const cfg = makeConfig({
      launcher: {
        ...makeConfig().launcher,
        photo_url: 'data:image/png;base64,iVBORw0K',
      },
    });
    mountPersonaCard(cfg, document.body, {});
    const img = document.querySelector('img.mcx-persona-photo') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.src).toBe('data:image/png;base64,iVBORw0K');
    // Must NOT render initials when photo is valid
    expect(document.querySelector('.mcx-persona-initials')).toBeNull();
  });
});
