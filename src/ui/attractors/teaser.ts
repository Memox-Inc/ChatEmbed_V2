// Teaser bubble attractor — small "Need help?" nudge that floats next
// to the launcher after a configurable delay.
//
// Suppression (pill, persona precedence) is the orchestrator's
// responsibility (src/index.ts). This module only guards against its
// own missing/empty config (teaser.enabled=false, teaser.text="").
//
// Returns a ``cleanup()`` so the host can cancel a pending timer or
// remove the rendered teaser without leaking listeners between
// re-mounts (e.g. an embed config swap during E2E tests).

import type { ChatEmbedConfig } from '../../config/types';
import type { AttractorHandle } from './types';

export type TeaserCleanup = () => void;

const DEFAULT_DELAY_SECONDS = 5;

export function mountTeaser(config: ChatEmbedConfig, host: HTMLElement): AttractorHandle {
  const launcher = config.launcher || {};
  const teaser = launcher.attractors?.teaser;

  // Suppression rules — return a no-op cleanup so callers can always
  // store the result without a null check.
  if (!teaser || !teaser.enabled || !teaser.text) return { cleanup: () => {} };

  const delayMs = (teaser.show_after_seconds ?? DEFAULT_DELAY_SECONDS) * 1000;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let element: HTMLDivElement | null = null;

  timerId = setTimeout(() => {
    timerId = null;
    element = renderTeaserBubble(teaser.text!, teaser.dismissible !== false);
    host.appendChild(element);
  }, delayMs);

  return {
    cleanup: () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (element && element.parentElement) {
        element.parentElement.removeChild(element);
      }
      element = null;
    },
  };
}

function renderTeaserBubble(text: string, dismissible: boolean): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'mcx-teaser';

  const span = document.createElement('span');
  span.className = 'mcx-teaser-text';
  span.textContent = text;
  root.appendChild(span);

  if (dismissible) {
    const close = document.createElement('button');
    close.className = 'mcx-teaser-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.type = 'button';
    close.textContent = '\u00D7'; // ×
    close.addEventListener('click', () => {
      root.remove();
    });
    root.appendChild(close);
  }

  return root;
}
