// Persistent pulse loop attractor. Toggles a CSS class on the launcher
// button when the embed has launcher.attractors.pulse.enabled = true.
// All visual state lives in widget.css under .mcx-launcher--pulse — this
// module just owns the policy decision.

import type { ChatEmbedConfig } from '../../config/types';
import type { AttractorHandle } from './types';

export function applyPulse(launcher: HTMLElement, config: ChatEmbedConfig): AttractorHandle {
  if (config.launcher?.attractors?.pulse?.enabled) {
    launcher.classList.add('mcx-launcher--pulse');
  }
  return {
    cleanup: () => {
      launcher.classList.remove('mcx-launcher--pulse');
    },
  };
}
