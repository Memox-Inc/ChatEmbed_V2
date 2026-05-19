import type { ChatEmbedConfig, StoredMessage, WelcomeMessageStyle } from '../../config/types';
import { markdownToHtml } from './markdown-renderer';
import { escapeHtml } from '../../utils/dom';
import { isSafeImageUrl } from '../../utils/url';

export interface BubbleRefs {
  container: HTMLDivElement;
  contentWrapper?: HTMLDivElement;
}

function createAvatar(
  sender: string,
  config: ChatEmbedConfig,
  photoUrl?: string,
): HTMLDivElement {
  const theme = config.theme || {};
  const av = document.createElement('div');
  av.className = `mcx-avatar mcx-avatar--${sender}`;

  if (sender === 'user') {
    const uIcon = theme.userIcon || config.userIcon || {};
    av.style.width = uIcon.userIconAvatarWidth || '29px';
    av.style.height = uIcon.userIconAvatarHeight || '29px';
    av.style.background = theme.userAvatar || '#8349ff';
    av.style.border = theme.userAvatarBorder || 'none';
    const color = theme.userAvatarSvgColor || '#fff';
    av.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  } else if (sender === 'sales_rep') {
    av.style.background = theme.salesRepAvatar || '#DBEAFE';
    av.style.border = theme.salesRepAvatarBorder || 'none';
    av.style.overflow = 'hidden';
    av.style.position = 'relative';
    const color = theme.salesRepAvatarSvgColor || theme.primary || '#8349FF';
    // Default-icon path: shown when no photoUrl is supplied AND as the
    // fallback rendering beneath the <img> so an onError silently
    // reveals it without leaving an empty circle.
    av.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    // MMX-551: signed R2/S3 URL → render the rep's real photo on top.
    // Built via DOM API (not innerHTML) — the URL comes from the
    // backend but we still want defense-in-depth against attribute
    // escape via a stray `"` in a presigned query string.
    if (photoUrl && isSafeImageUrl(photoUrl)) {
      const img = document.createElement('img');
      img.src = photoUrl;
      img.alt = '';
      img.style.position = 'absolute';
      img.style.inset = '0';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.onerror = () => {
        img.remove();
      };
      av.appendChild(img);
    }
  } else {
    const bIcon = theme.botIcon || config.botIcon || {};
    av.style.width = bIcon.botIconAvatarWidth || '29px';
    av.style.height = bIcon.botIconAvatarHeight || '29px';
    av.style.background = theme.botAvatar || '#E2E8F0';
    av.style.border = theme.botAvatarBorder || 'none';
    av.style.borderRadius = '8px';

    if (isSafeImageUrl(bIcon.botAvatarUrl)) {
      // Build via DOM API instead of innerHTML — an attacker-controlled
      // backend response carrying a URL with a stray `"` would otherwise
      // escape the src attribute and inject HTML into the shadow root.
      const img = document.createElement('img');
      img.src = bIcon.botAvatarUrl;
      img.alt = 'Bot';
      img.style.width = bIcon.svgWidth || '14px';
      img.style.height = bIcon.svgHeight || '14px';
      img.style.objectFit = bIcon.objectFit || 'contain';
      av.replaceChildren(img);
    } else {
      const color = theme.botAvatarSvgColor || theme.primary || '#6366f1';
      av.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`;
    }
  }
  return av;
}

export function createMessageBubble(
  msg: StoredMessage,
  config: ChatEmbedConfig,
  isLast: boolean,
  welcomeMessageStyle?: WelcomeMessageStyle,
): BubbleRefs {
  const theme = config.theme || {};
  const container = document.createElement('div');
  container.className = `mcx-msg-group${msg.sender === 'user' ? ' mcx-msg-group--user' : ''}`;

  const avatar = createAvatar(
    msg.sender === 'ai' ? 'bot' : msg.sender,
    config,
    msg.sender === 'sales_rep' ? msg.senderPhotoUrl : undefined,
  );
  const bubble = document.createElement('div');
  bubble.className = 'mcx-msg-stack';
  if (msg.sender === 'user') bubble.classList.add('mcx-msg-stack--user');

  const msgDiv = document.createElement('div');
  msgDiv.className = `mcx-bubble mcx-bubble--${msg.sender === 'ai' ? 'bot' : msg.sender}`;

  let contentWrapper: HTMLDivElement | undefined;

  // Typing indicator (empty text as last message)
  if (msg.text === '' && isLast) {
    msgDiv.innerHTML = '<div class="mcx-typing-dots"><span class="mcx-td"></span><span class="mcx-td"></span><span class="mcx-td"></span></div>';
  } else if (msg.sender === 'bot' || msg.sender === 'ai') {
    contentWrapper = document.createElement('div');
    let html = markdownToHtml(msg.text, theme.botText);

    // Apply welcome message styles
    if (msg.isWelcomeMessage && welcomeMessageStyle) {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const ps = temp.querySelectorAll('p');
      if (welcomeMessageStyle.lineHeight) {
        ps.forEach((p) => (p.style.lineHeight = welcomeMessageStyle.lineHeight!));
      }
      if (welcomeMessageStyle.body && ps.length > 1) {
        for (let i = 1; i < ps.length - 1; i++) {
          if (welcomeMessageStyle.body.marginTop) ps[i].style.marginTop = welcomeMessageStyle.body.marginTop;
          if (welcomeMessageStyle.body.color) ps[i].style.color = welcomeMessageStyle.body.color;
        }
      }
      if (welcomeMessageStyle.closing && ps.length > 2) {
        const last = ps[ps.length - 1];
        if (welcomeMessageStyle.closing.marginTop) last.style.marginTop = welcomeMessageStyle.closing.marginTop;
      }
      html = temp.innerHTML;
    }

    contentWrapper.innerHTML = html;
    if (msg.isStreaming && isLast) {
      contentWrapper.setAttribute('data-streaming', 'true');
    }
    msgDiv.appendChild(contentWrapper);
  } else if (msg.sender === 'sales_rep') {
    contentWrapper = document.createElement('div');
    const messageText = escapeHtml(msg.text).replace(/\n/g, '<br>');
    let senderName = 'Sales Representative';
    if (msg.senderName) {
      if (typeof msg.senderName === 'string') senderName = msg.senderName;
      else if (msg.senderName.name) senderName = msg.senderName.name;
    }
    contentWrapper.innerHTML =
      `<div class="mcx-rep-name">~ ${senderName}</div>${messageText}`;
    msgDiv.appendChild(contentWrapper);
  } else {
    contentWrapper = document.createElement('div');
    contentWrapper.innerHTML = escapeHtml(msg.text).replace(/\n/g, '<br>');
    msgDiv.appendChild(contentWrapper);
  }

  bubble.appendChild(msgDiv);

  // Timestamp
  if (!msg.isWelcomeMessage && msg.created_at) {
    const ts = document.createElement('div');
    ts.className = 'mcx-timestamp';
    if (msg.sender === 'user') ts.classList.add('mcx-timestamp--right');
    ts.textContent = msg.created_at;
    bubble.appendChild(ts);
  }

  container.appendChild(avatar);
  container.appendChild(bubble);

  return { container, contentWrapper };
}
