import type { ChatEmbedConfig } from '../config/types';

// Inline chat-bubble glyph used for both round and pill form factors.
// Kept identical to the V1 launcher so the visual identity doesn't shift
// when an embed flips between attractor variants.
const CHAT_BUBBLE_SVG = `<svg class="mcx-launcher-icon" width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3 20V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 16V10l5 4 5-4v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CLOSE_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export function createLauncher(
  config: ChatEmbedConfig,
  onClick: () => void,
): HTMLButtonElement {
  const launcherCfg = config.launcher || {};
  const isPill = launcherCfg.form_factor === 'pill';

  const btn = document.createElement('button');
  btn.className = 'mcx-launcher';
  if (isPill) btn.classList.add('mcx-launcher--pill');
  btn.title = 'Open chat';

  if (config.position === 'left') {
    btn.classList.add('mcx-launcher--left');
  }

  // Icon. customIcon is supplied by the embed owner (trusted source —
  // it's set in the agent settings dashboard, not by visitors). Falls
  // back to the constant chat-bubble SVG.
  if (config.customIcon) {
    if (/^https?:\/\//.test(config.customIcon) || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(config.customIcon)) {
      const img = document.createElement('img');
      img.src = config.customIcon;
      img.alt = 'Chat';
      img.className = 'mcx-launcher-img';
      btn.appendChild(img);
    } else {
      btn.insertAdjacentHTML('beforeend', config.customIcon);
    }
  } else {
    btn.insertAdjacentHTML('beforeend', CHAT_BUBBLE_SVG);
  }

  // Pill text — appended after the icon so the layout reads icon → label.
  // textContent (not innerHTML) defends against HTML injection from a
  // hostile or stale launcher config; the rest of the widget assumes
  // anything coming off the wire is untrusted.
  if (isPill) {
    const textSpan = document.createElement('span');
    textSpan.className = 'mcx-launcher-pill-text';
    const raw = (launcherCfg.pill_text ?? '').trim();
    textSpan.textContent = raw || 'Chat';
    btn.appendChild(textSpan);
  }

  // Close icon (hidden by default — toggled via mcx-launcher--open class).
  const closeIcon = document.createElement('span');
  closeIcon.className = 'mcx-launcher-close';
  closeIcon.insertAdjacentHTML('beforeend', CLOSE_SVG);
  btn.appendChild(closeIcon);

  btn.addEventListener('click', onClick);

  return btn;
}
