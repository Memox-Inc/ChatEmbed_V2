// Notification badge attractor — small "1" indicator that implies an
// unread message waiting in the chat. Two visual variants:
//   - round launcher: red corner-dot, top-right
//   - pill launcher : inline brand-coloured chip after the label
//
// The badge is consumed on first chat open: ``mountBadge`` returns a
// ``clearBadge()`` that the host should invoke inside the open branch
// of its toggle handler. Closing the chat must NOT restore the badge —
// once cleared, the visit is "engaged" and the nudge is no longer
// needed.

import type { ChatEmbedConfig } from '../../config/types';
import type { AttractorHandle } from './types';

export type ClearBadge = () => void;

export function mountBadge(launcher: HTMLElement, config: ChatEmbedConfig): AttractorHandle {
  const enabled = config.launcher?.attractors?.badge?.enabled === true;
  if (!enabled) return { cleanup: () => {} };

  const isPill = config.launcher?.form_factor === 'pill';
  const badge = document.createElement('span');
  badge.className = isPill ? 'mcx-badge mcx-badge--inline' : 'mcx-badge';
  badge.setAttribute('aria-label', '1 unread message');
  badge.textContent = '1';
  launcher.appendChild(badge);

  return {
    cleanup: () => {
      if (badge.parentElement) {
        badge.parentElement.removeChild(badge);
      }
    },
  };
}
