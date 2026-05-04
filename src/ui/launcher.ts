import type { ChatEmbedConfig, LauncherConfig } from '../config/types';

// Inline chat-bubble glyph used as the default icon and as the small
// indicator badge on the photo variant.
const CHAT_BUBBLE_SVG = `<svg class="mcx-launcher-icon" width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3 20V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 16V10l5 4 5-4v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Smaller bubble for the photo-mode indicator badge in the lower-right.
const CHAT_BUBBLE_BADGE_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M3 20V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 16V10l5 4 5-4v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CLOSE_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

// Allow only http(s) and data: URLs for launcher images. Server uploads
// always produce https URLs; data: lets us inline tiny placeholders for
// previews. For data: URLs, only allow safe raster formats (png, jpeg, gif, webp).
// Reject data:image/svg+xml to prevent embedded JavaScript execution.
// Anything else (javascript:, file:, …) is rejected and the launcher falls through to the bubble icon.
function isSafeImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return /^https?:\/\//.test(url) || /^data:image\/(png|jpeg|gif|webp);/.test(url);
}

function appendBubbleIcon(parent: HTMLElement): void {
  parent.insertAdjacentHTML('beforeend', CHAT_BUBBLE_SVG);
}

function appendPhotoIcon(parent: HTMLElement, photoUrl: string): void {
  const img = document.createElement('img');
  img.src = photoUrl;
  img.alt = '';
  img.className = 'mcx-launcher-photo-img';
  parent.appendChild(img);

  const indicator = document.createElement('span');
  indicator.className = 'mcx-launcher-photo-indicator';
  indicator.insertAdjacentHTML('beforeend', CHAT_BUBBLE_BADGE_SVG);
  parent.appendChild(indicator);
}

function appendCustomLogo(parent: HTMLElement, logoUrl: string): void {
  const img = document.createElement('img');
  img.src = logoUrl;
  img.alt = '';
  img.className = 'mcx-launcher-custom-img';
  parent.appendChild(img);
}

function renderIcon(parent: HTMLElement, launcher: LauncherConfig): { isPhoto: boolean } {
  const iconType = launcher.icon_type || 'bubble';

  if (iconType === 'photo' && isSafeImageUrl(launcher.photo_url)) {
    appendPhotoIcon(parent, launcher.photo_url);
    return { isPhoto: true };
  }

  if (iconType === 'custom' && isSafeImageUrl(launcher.custom_icon_url)) {
    appendCustomLogo(parent, launcher.custom_icon_url);
    return { isPhoto: false };
  }

  appendBubbleIcon(parent);
  return { isPhoto: false };
}

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

  // Legacy customIcon (set via top-level config.customIcon) takes
  // precedence over launcher.icon_type for backwards compatibility with
  // V1 embeds that haven't been migrated yet. New embeds should use
  // launcher.icon_type + launcher.custom_icon_url / photo_url.
  //
  // Security: only accept URLs that pass isSafeImageUrl (http(s) or data:image/*)
  // AND are either a safe data:image/ URL or end with a known image extension.
  // Reject data:image/svg+xml to prevent embedded JavaScript execution.
  // Any other value (raw HTML, javascript: schemes, plain text) is rejected
  // and falls through to renderIcon so the launcher is never left empty.
  const isValidCustomIcon =
    config.customIcon &&
    isSafeImageUrl(config.customIcon) &&
    (/^data:image\/(png|jpeg|gif|webp);/.test(config.customIcon) || /\.(png|jpg|jpeg|gif|webp)$/i.test(config.customIcon));

  if (isValidCustomIcon) {
    const img = document.createElement('img');
    img.src = config.customIcon as string;
    img.alt = 'Chat';
    img.className = 'mcx-launcher-img';
    btn.appendChild(img);
  } else {
    const { isPhoto } = renderIcon(btn, launcherCfg);
    if (isPhoto) btn.classList.add('mcx-launcher--photo');
  }

  // Pill text — appended after the icon so the layout reads icon → label.
  // textContent (not innerHTML) defends against HTML injection from a
  // hostile or stale launcher config.
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
