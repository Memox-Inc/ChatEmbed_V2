import type { ChatEmbedConfig } from '../config/types';

export function createLauncher(
  config: ChatEmbedConfig,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'mcx-launcher';
  btn.title = 'Open chat';

  if (config.position === 'left') {
    btn.classList.add('mcx-launcher--left');
  }

  // Icon
  if (config.customIcon) {
    if (/^https?:\/\//.test(config.customIcon) || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(config.customIcon)) {
      btn.innerHTML = `<img src="${config.customIcon}" alt="Chat" class="mcx-launcher-img">`;
    } else {
      btn.innerHTML = config.customIcon;
    }
  } else {
    btn.innerHTML = `<svg class="mcx-launcher-icon" width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3 20V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 16V10l5 4 5-4v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // Close icon (hidden by default)
  const closeIcon = document.createElement('span');
  closeIcon.className = 'mcx-launcher-close';
  closeIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  btn.appendChild(closeIcon);

  btn.addEventListener('click', onClick);

  return btn;
}
