import type { ChatEmbedConfig } from '../config/types';

export interface HeaderRefs {
  header: HTMLDivElement;
  refreshBtn: HTMLButtonElement;
  clearSessionBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  setButtonsDisabled: (disabled: boolean) => void;
}

export function createHeader(
  config: ChatEmbedConfig,
  onRefresh: () => void,
  onClearSession: () => void,
  onClose: () => void,
): HeaderRefs {
  const theme = config.theme || {};
  const hs = theme.headerStyle || {};

  const header = document.createElement('div');
  header.className = 'mcx-header';

  // Title area
  const titleWrap = document.createElement('div');
  titleWrap.className = 'mcx-header-title-wrap';

  // Logo
  const logoStyle = hs.logoStyle || {};
  const logoUrl = logoStyle.logoUrl || hs.logoUrl || '';
  if (logoUrl) {
    const logo = document.createElement('img');
    logo.src = logoUrl;
    logo.alt = 'Logo';
    logo.className = 'mcx-header-logo';
    logo.style.width = logoStyle.logoWidth || hs.logoWidth || '24px';
    logo.style.height = logoStyle.logoHeight || hs.logoHeight || '24px';
    logo.style.borderRadius = logoStyle.borderRadius || '0';
    titleWrap.appendChild(logo);
  } else {
    // Default chat icon as logo placeholder
    const logoDiv = document.createElement('div');
    logoDiv.className = 'mcx-header-logo-default';
    logoDiv.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    titleWrap.appendChild(logoDiv);
  }

  const titleInfo = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'mcx-header-title';
  title.textContent = config.title || 'Chat';
  titleInfo.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'mcx-header-subtitle';
  subtitle.innerHTML = `<span class="mcx-status-dot"></span><span>Online</span>`;
  titleInfo.appendChild(subtitle);

  titleWrap.appendChild(titleInfo);
  header.appendChild(titleWrap);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'mcx-header-actions';

  const refreshBtn = createHeaderBtn(
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    'Clear chat history',
  );
  refreshBtn.addEventListener('click', onRefresh);

  const clearSessionBtn = createHeaderBtn(
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    'Clear session & restart',
  );
  clearSessionBtn.addEventListener('click', onClearSession);

  const closeBtn = createHeaderBtn(
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    'Close chat',
  );
  if (config.mode === 'inline') {
    closeBtn.style.display = 'none';
  } else {
    const closeDisplay = theme.closeBtnIconStyle?.display ?? 'flex';
    closeBtn.style.display = closeDisplay || 'flex';
  }
  closeBtn.addEventListener('click', onClose);

  actions.appendChild(refreshBtn);
  actions.appendChild(clearSessionBtn);
  actions.appendChild(closeBtn);
  header.appendChild(actions);

  function setButtonsDisabled(disabled: boolean): void {
    refreshBtn.classList.toggle('mcx-header-btn--disabled', disabled);
    clearSessionBtn.classList.toggle('mcx-header-btn--disabled', disabled);
  }

  return { header, refreshBtn, clearSessionBtn, closeBtn, setButtonsDisabled };
}

function createHeaderBtn(svgHtml: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'mcx-header-btn';
  btn.title = title;
  btn.innerHTML = svgHtml;
  return btn;
}
