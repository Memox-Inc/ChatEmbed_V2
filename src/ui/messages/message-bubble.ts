import type { ChatEmbedConfig, StoredMessage, WelcomeMessageStyle } from '../../config/types';
import { markdownToHtml } from './markdown-renderer';
import { escapeHtml } from '../../utils/dom';
import { isSafeImageUrl } from '../../utils/url';
import { renderComponentsBlock, renderSuggestionPills } from '../../components/core/message-integration';
import type { WireComponent, RenderCtx } from '../../components/core/types';

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
    av.style.background = theme.botAvatar || '#E4E7FC';
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
      const color = theme.botAvatarSvgColor || theme.primary || '#8349FF';
      av.style.color = color;
      // Robot-face bot avatar — head with two eyes + smile and a thin
      // antenna with a bead. Filled with currentColor so the dashboard's
      // ``botAvatarSvgColor`` / ``primary`` theme override flows through
      // via ``av.style.color`` above. Same SVG used by the lead-capture
      // form's welcome bubble and the thinking indicator so the bot
      // identity stays consistent across every surface.
      av.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle class="antenna-ball" cx="12" cy="2.5" r="0.9" fill="currentColor" stroke="none"/><path d="M12 3.4v2.1"/><circle class="cable-bead" cx="12" cy="4.45" r="0.45" fill="currentColor" stroke="none"/><rect x="4" y="5.5" width="16" height="14" rx="4"/><circle class="eye-left" cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle class="eye-right" cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><path class="smile" d="M10.5 16q1.5 0.8 3 0" stroke-width="1.4" fill="none"/></svg>`;
    }
  }
  return av;
}

export function createMessageBubble(
  msg: StoredMessage,
  config: ChatEmbedConfig,
  isLast: boolean,
  welcomeMessageStyle?: WelcomeMessageStyle,
  options?: {
    components?: WireComponent[];
    suggestions?: string[];
    ctx?: RenderCtx;
    onSuggestionSelect?: (s: string) => void;
  },
): BubbleRefs {
  const theme = config.theme || {};
  const container = document.createElement('div');
  container.className = `mcx-msg-group${msg.sender === 'user' ? ' mcx-msg-group--user' : ''}`;
  if (msg.messageId) container.setAttribute('data-message-id', msg.messageId);

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

  if (options?.components?.length && options.ctx) {
    const block = renderComponentsBlock(options.components, options.ctx);
    if (block) bubble.appendChild(block);
  }
  if (options?.suggestions?.length && options.onSuggestionSelect && options.ctx) {
    const pills = renderSuggestionPills(options.suggestions, options.onSuggestionSelect, options.ctx.theme);
    if (pills) bubble.appendChild(pills);
  }

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
