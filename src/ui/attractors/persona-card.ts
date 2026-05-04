// Persona card attractor — the richest of the launcher attractors.
// Renders a small card with a photo or initials, a name, a message, and
// optional quick-question chips. Built entirely with createElement +
// textContent so server-supplied strings (name, message, chip labels)
// can never inject HTML.
//
// Composability:
//   - photo_url falls back to initials when missing or unsafe
//   - chips slice off at 3 to avoid overflowing the card
//   - chip click bubbles to the host via onChipClick(label) so the host
//     can pre-fill the input — this module doesn't reach into the
//     widget's DOM directly.

import type { ChatEmbedConfig } from '../../config/types';
import type { AttractorHandle } from './types';
import { isSafeImageUrl } from '../../utils/url';

export interface PersonaHandlers {
  onOpen?: () => void;
  onChipClick?: (label: string) => void;
}

export type PersonaCleanup = () => void;

const MAX_CHIPS = 3;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function mountPersonaCard(
  config: ChatEmbedConfig,
  host: HTMLElement,
  handlers: PersonaHandlers,
): AttractorHandle {
  const persona = config.launcher?.attractors?.persona;
  if (!persona || !persona.enabled || !persona.name || !persona.message) return { cleanup: () => {} };

  const photoUrl = config.launcher?.photo_url;
  const card = document.createElement('div');
  card.className = 'mcx-persona-card';

  const row = document.createElement('div');
  row.className = 'mcx-persona-row';

  if (isSafeImageUrl(photoUrl)) {
    const img = document.createElement('img');
    img.className = 'mcx-persona-photo';
    img.src = photoUrl;
    img.alt = '';
    row.appendChild(img);
  } else {
    const ini = document.createElement('div');
    ini.className = 'mcx-persona-initials';
    ini.textContent = initialsOf(persona.name);
    row.appendChild(ini);
  }

  const text = document.createElement('div');
  text.className = 'mcx-persona-text';

  const nameEl = document.createElement('div');
  nameEl.className = 'mcx-persona-name';
  nameEl.textContent = persona.name;

  const msgEl = document.createElement('div');
  msgEl.className = 'mcx-persona-msg';
  msgEl.textContent = persona.message;

  text.appendChild(nameEl);
  text.appendChild(msgEl);
  row.appendChild(text);
  card.appendChild(row);

  if (persona.show_chips && config.quickQuestions && config.quickQuestions.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'mcx-persona-chips';
    config.quickQuestions.slice(0, MAX_CHIPS).forEach((label) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'mcx-persona-chip';
      chip.textContent = label;
      chip.addEventListener('click', () => {
        handlers.onChipClick?.(label);
        handlers.onOpen?.();
        card.remove();
      });
      chipsRow.appendChild(chip);
    });
    card.appendChild(chipsRow);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'mcx-persona-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '\u00D7';
  close.addEventListener('click', () => card.remove());
  card.appendChild(close);

  host.appendChild(card);

  return {
    cleanup: () => {
      if (card.parentElement) card.parentElement.removeChild(card);
    },
  };
}
