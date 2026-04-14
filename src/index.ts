import type { ChatEmbedConfig, StoredMessage, VisitorInfo, WelcomeMessageStyle } from './config/types';
import { defaultConfig } from './config/defaults';
import { mergeConfig } from './config/merge';
import { generateChatId } from './utils/uuid';
import { formatTimeStamp } from './utils/timestamp';
import { sanitizeInput } from './utils/dom';
import { sessionStore } from './session/session-store';
import { validateSession, createVisitor } from './connection/api-client';
import { WebSocketManager, type WsMessageData } from './connection/websocket-manager';
import { createShadowHost, createInlineShadowHost } from './ui/shadow-host';
import { createWidgetContainer } from './ui/widget-container';
import { createHeader } from './ui/header';
import { createMessageList } from './ui/messages/message-list';
import { createMessageBubble } from './ui/messages/message-bubble';
import { createSystemNotification } from './ui/messages/system-notification';
import { StreamingRenderer } from './ui/messages/streaming-renderer';
import { createInputBar } from './ui/input/input-bar';
import { createQuickQuestions } from './ui/input/quick-questions';
import { createLeadCaptureForm, type LeadData } from './ui/forms/lead-capture-form';
import { createLauncher } from './ui/launcher';
import { normalizePhoneE164 } from './ui/forms/validation';

declare global {
  interface Window {
    SimpleChatEmbedConfig?: Partial<ChatEmbedConfig>;
    MemoxChatConfig?: Partial<ChatEmbedConfig>;
    SimpleChatEmbedLead?: LeadData;
    __simpleChatEmbedLeadCaptured?: boolean;
    openChat?: () => void;
    closeChat?: () => void;
    toggleChat?: () => void;
  }
}

function init(): void {
  const userConfig = window.MemoxChatConfig || window.SimpleChatEmbedConfig || {};
  const config = mergeConfig(defaultConfig, userConfig);
  const theme = config.theme || {};
  const welcomeMessage = config.welcomeMessage || null;
  const welcomeMessageStyle = config.welcomeMessageStyle as WelcomeMessageStyle | undefined;
  const leadCapture = config.leadCapture !== undefined ? config.leadCapture : true;

  // State
  let visitorInfo: VisitorInfo | null = null;
  let chatID: string | null = null;
  let isHandoverActive = false;
  let isFormShowing = false;
  let isBotResponding = false;
  let chatOpen = false;

  // --- Shadow DOM setup ---
  let root: ShadowRoot;
  let host: HTMLElement;

  if (config.mode === 'inline') {
    // For inline mode, find parent container by selector, ID convention, or script tag's parent
    const parentSelector = (userConfig as Record<string, unknown>).parentSelector as string | undefined;
    let parent: HTMLElement | null = null;
    if (parentSelector) {
      parent = document.querySelector<HTMLElement>(parentSelector);
    }
    if (!parent) {
      parent = document.getElementById('memox-chat-container');
    }
    if (!parent) {
      // Find the script tag that loaded us and use its parent
      const scripts = document.querySelectorAll('script[src*="chat-embed"]');
      const lastScript = scripts[scripts.length - 1];
      if (lastScript?.parentElement) {
        parent = lastScript.parentElement;
      }
    }
    const result = createInlineShadowHost(parent || document.body);
    host = result.host;
    root = result.root;
  } else {
    const result = createShadowHost();
    host = result.host;
    root = result.root;
    document.body.appendChild(host);
  }

  // --- Create UI ---
  const widget = createWidgetContainer(config);
  const { messagesEl, scrollToBottom, forceScrollToBottom, checkScrollPosition, scrollBtn } = createMessageList();
  const streamingRenderer = new StreamingRenderer(messagesEl, theme.botText);

  const inputBar = createInputBar(handleSend);

  let quickQuestionsEl: HTMLDivElement | null = null;
  if (config.quickQuestions && config.quickQuestions.length > 0) {
    quickQuestionsEl = createQuickQuestions(
      config.quickQuestions,
      (q) => { handleSend(q); },
      !!config.quickQuestionsPermanent,
    );
  }

  const headerRefs = createHeader(
    config,
    handleRefresh,
    handleClearSession,
    handleClose,
  );

  // Powered by footer
  const poweredBy = document.createElement('div');
  poweredBy.className = 'mcx-powered-by';
  poweredBy.innerHTML = 'Powered by <span>Memox</span>';

  // Assemble widget
  widget.appendChild(headerRefs.header);
  widget.appendChild(messagesEl);
  widget.appendChild(scrollBtn);
  if (quickQuestionsEl) widget.appendChild(quickQuestionsEl);
  widget.appendChild(inputBar.container);
  widget.appendChild(poweredBy);
  root.appendChild(widget);

  // WebSocket
  const ws = new WebSocketManager(config, handleWsMessage);

  // Launcher (floating mode only)
  let launcher: HTMLButtonElement | null = null;
  if (config.mode !== 'inline') {
    launcher = createLauncher(config, handleToggle);
    root.appendChild(launcher);
  }

  // --- Core functions ---

  function saveMessage(text: string, sender: StoredMessage['sender'], type = ''): void {
    const msgs = sessionStore.getMessages();
    if (type === 'welcomeMessage') {
      const idx = msgs.findIndex((m) => m.isWelcomeMessage);
      if (idx !== -1) {
        msgs[idx].text = text;
      } else {
        msgs.push({ text, isWelcomeMessage: true, sender });
      }
      sessionStore.setMessages(msgs);
    } else {
      sessionStore.pushMessage({
        text,
        isWelcomeMessage: false,
        sender,
        created_at: formatTimeStamp(new Date().toISOString()),
      });
    }
  }

  function loadMessages(): void {
    const msgs = sessionStore.getMessages();
    messagesEl.innerHTML = '';

    // Check handover
    if (msgs.some((m) => m.isSystemNotification && m.notificationType === 'joined')) {
      isHandoverActive = true;
    }

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const isLast = i === msgs.length - 1;

      if (msg.isSystemNotification) {
        const notif = createSystemNotification(
          msg,
          theme.handoverNotificationBg,
          theme.handoverNotificationText,
          theme.handoverNotificationBorder,
        );
        messagesEl.appendChild(notif);
        continue;
      }

      const { container, contentWrapper } = createMessageBubble(
        msg,
        config,
        isLast,
        welcomeMessageStyle,
      );
      messagesEl.appendChild(container);

      // Track streaming element
      if (msg.isStreaming && isLast && contentWrapper) {
        streamingRenderer.setActiveElement(contentWrapper);
        streamingRenderer.setText(msg.text);
      }
    }

    // Quick questions
    if (quickQuestionsEl) {
      messagesEl.appendChild(quickQuestionsEl);
      const isFirstSession = msgs.length === 0 || (msgs.length === 1 && msgs[0].isWelcomeMessage);
      if (config.quickQuestionsPermanent || isFirstSession) {
        quickQuestionsEl.style.display = 'flex';
      } else {
        quickQuestionsEl.style.display = 'none';
      }
    }

    scrollToBottom();
    setTimeout(() => {
      scrollToBottom();
      checkScrollPosition();
    }, 100);
  }

  function setBotResponding(responding: boolean): void {
    isBotResponding = responding;
    inputBar.setBotResponding(responding);
  }

  async function connectWebSocket(): Promise<void> {
    if (ws.connected) return;

    const session = sessionStore.getSession();
    if (session?.chatID && session?.visitorInfo) {
      chatID = session.chatID;
      visitorInfo = session.visitorInfo;

      const isValid = await validateSession(chatID, config);
      if (!isValid) {
        showSessionClosedNotification('This chat session has been closed.');
        return;
      }
    }

    if (!chatID) {
      chatID = generateChatId();
      const sessionData: Record<string, unknown> = {
        chatID,
        timestamp: new Date().toISOString(),
      };
      if (leadCapture && visitorInfo) {
        sessionData.visitorInfo = visitorInfo;
      }
      sessionStore.setSession(sessionData);
    }

    ws.connect(visitorInfo, chatID);
  }

  function handleWsMessage(data: WsMessageData): void {
    // Only process messages for our room (or broadcasts)
    if (data.room_name && data.room_name !== chatID) return;

    // Error message
    if (data.message_type === 'error_message') {
      showSessionClosedNotification(data.content || data.message || 'This chat session has been closed.');
      return;
    }

    // Skip unread / handover_requested
    if (data.message_type === 'unread_message' || data.message_type === 'handover_requested') return;

    // Handover message
    if (data.message_type === 'handover_message') {
      isHandoverActive = true;
      sessionStore.updateSession({ handoverOccurred: true });

      const senderName = typeof data.sender === 'object' ? data.sender?.name : String(data.sender);
      sessionStore.pushMessage({
        text: `${senderName} has entered the chat`,
        sender: 'system',
        isWelcomeMessage: false,
        isSystemNotification: true,
        notificationType: 'joined',
        created_at: formatTimeStamp(data.created_at || new Date().toISOString()),
      });
      loadMessages();
      return;
    }

    const senderType = data.sender_type || (typeof data.sender === 'string' ? data.sender : '');

    // AI/bot messages
    if ((senderType === 'ai' || senderType === 'bot') && !isHandoverActive) {
      const msgs = sessionStore.getMessages();
      let lastMessage = msgs[msgs.length - 1] || null;

      // Remove typing indicator
      if (lastMessage && lastMessage.text === '' && (lastMessage.sender === 'bot' || lastMessage.sender === 'ai')) {
        msgs.pop();
        sessionStore.setMessages(msgs);
        lastMessage = msgs[msgs.length - 1] || null;
      }

      const content = data.content || data.message || '';

      // Deduplicate
      if (streamingRenderer.isDuplicateChunk(content)) return;

      // Completion signal
      if (data.is_complete === true && content === '') {
        if (lastMessage?.isStreaming) {
          lastMessage.isStreaming = false;
          msgs[msgs.length - 1] = lastMessage;
          sessionStore.setMessages(msgs);
          streamingRenderer.reset();
          loadMessages();
        }
        setBotResponding(false);
        return;
      }

      if (content) {
        if (lastMessage && (lastMessage.sender === 'bot' || lastMessage.sender === 'ai') && lastMessage.isStreaming) {
          // Append to existing streaming message
          lastMessage.text += content;
          lastMessage.lastChunkTime = Date.now();
          msgs[msgs.length - 1] = lastMessage;
          sessionStore.setMessages(msgs);

          if (streamingRenderer.activeElement) {
            streamingRenderer.setText(lastMessage.text);
            streamingRenderer.scheduleUpdate();
          } else {
            loadMessages();
          }
        } else {
          // New streaming message
          streamingRenderer.reset();
          sessionStore.pushMessage({
            text: content,
            sender: 'bot',
            isWelcomeMessage: false,
            isStreaming: true,
            messageId: data.message_id,
            created_at: formatTimeStamp(data.created_at || new Date().toISOString()),
            lastChunkTime: Date.now(),
          });
          loadMessages();
        }
      }
    }
    // Sales rep messages
    else if (senderType === 'sales_rep') {
      const content = data.content || '';
      if (!content.trim()) return;

      sessionStore.pushMessage({
        text: content,
        sender: 'sales_rep',
        senderName: (typeof data.sender === 'string' ? data.sender : data.sender_name) || 'Sales Representative',
        isWelcomeMessage: false,
        created_at: formatTimeStamp(data.created_at || new Date().toISOString()),
      });
      setBotResponding(false);
      loadMessages();
    }
  }

  function handleSend(text: string): void {
    if (!text.trim()) return;
    if (isBotResponding) return;

    saveMessage(text, 'user');
    loadMessages();

    // Typing indicator (only when no handover)
    if (!isHandoverActive) {
      saveMessage('', 'bot');
      loadMessages();
      setBotResponding(true);
    }

    const sendPayload = {
      message: text,
      message_type: 'text',
      room_name: chatID,
    };

    if (!ws.connected || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      const checkAndSend = (): void => {
        if (!chatID) return;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(sendPayload);
        } else if (ws.readyState === WebSocket.CONNECTING) {
          setTimeout(checkAndSend, 100);
        } else {
          // Connection failed
          const msgs = sessionStore.getMessages();
          if (msgs.length > 0 && msgs[msgs.length - 1].text === '') msgs.pop();
          msgs.push({ text: 'Error: Could not connect to chat service.', sender: 'bot', isWelcomeMessage: false });
          sessionStore.setMessages(msgs);
          loadMessages();
        }
      };
      setTimeout(checkAndSend, 500);
    } else {
      try {
        ws.send(sendPayload);
      } catch (error) {
        console.error('Error sending message:', error);
        const msgs = sessionStore.getMessages();
        if (msgs.length > 0 && msgs[msgs.length - 1].text === '') msgs.pop();
        msgs.push({ text: 'Error sending message. Please try again.', sender: 'bot', isWelcomeMessage: false });
        sessionStore.setMessages(msgs);
        setBotResponding(false);
        loadMessages();
      }
    }
  }

  function showSessionClosedNotification(message: string): void {
    sessionStore.pushMessage({
      text: message,
      sender: 'system',
      isWelcomeMessage: false,
      isSystemNotification: true,
      notificationType: 'session_closed',
      created_at: formatTimeStamp(new Date().toISOString()),
    });
    loadMessages();
    inputBar.setDisabled(true);
    setTimeout(() => resetSession(), 3000);
  }

  function handleRefresh(): void {
    if (isFormShowing) return;

    const msgs = sessionStore.getMessages();
    const wasHandover = msgs.some((m) => m.isSystemNotification && m.notificationType === 'joined');
    const session = sessionStore.getSession();
    const sessionHandover = session?.handoverOccurred === true;

    sessionStore.clearMessages();
    isHandoverActive = wasHandover || sessionHandover;

    setupChatInput();
    if (welcomeMessage) saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
    loadMessages();
  }

  function handleClearSession(): void {
    if (isFormShowing) return;
    resetSession();
  }

  function handleClose(): void {
    if (config.mode === 'inline') return;
    chatOpen = false;
    widget.classList.remove('mcx-widget--open');
    widget.classList.add('mcx-widget--closing');
    setTimeout(() => {
      widget.classList.remove('mcx-widget--closing');
      widget.style.display = 'none';
    }, 200);
    if (launcher) launcher.style.display = 'flex';
  }

  function handleToggle(): void {
    if (chatOpen) {
      handleClose();
    } else {
      chatOpen = true;
      widget.style.display = 'flex';
      widget.classList.add('mcx-widget--open');
      widget.classList.remove('mcx-widget--closing');
      if (launcher) launcher.style.display = 'none';

      // Validate session on open
      const session = sessionStore.getSession();
      if (session?.chatID) {
        validateSession(session.chatID, config).then((isValid) => {
          if (!isValid) showSessionClosedNotification('This chat session has been closed.');
        });
      }

      setTimeout(() => forceScrollToBottom(), 150);
    }
  }

  async function resetSession(): Promise<void> {
    sessionStore.clearAll();
    isHandoverActive = false;
    isFormShowing = false;
    window.__simpleChatEmbedLeadCaptured = false;
    visitorInfo = null;
    chatID = null;
    ws.close();
    inputBar.setDisabled(false);
    messagesEl.innerHTML = '';

    if (!leadCapture) {
      window.__simpleChatEmbedLeadCaptured = true;
      setupChatInput();
      try {
        visitorInfo = await createVisitor(null, null, null, null, config);
        sessionStore.updateSession({ visitorInfo });
      } catch (e) {
        console.error('Failed to create anonymous visitor:', e);
      }
      if (welcomeMessage) saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
      loadMessages();
      connectWebSocket();
    } else {
      inputBar.container.style.display = 'none';
      showLeadForm();
    }
  }

  function showLeadForm(): void {
    isFormShowing = true;
    headerRefs.setButtonsDisabled(true);

    let formEl: HTMLDivElement | null = null;
    formEl = createLeadCaptureForm(config, async (lead) => {
      isFormShowing = false;
      headerRefs.setButtonsDisabled(false);
      window.__simpleChatEmbedLeadCaptured = true;
      // Remove form, restore widget content
      if (formEl && formEl.parentElement) formEl.remove();
      messagesEl.style.display = '';
      scrollBtn.style.display = '';
      if (quickQuestionsEl) quickQuestionsEl.style.display = '';
      poweredBy.style.display = '';

      if (lead) {
        window.SimpleChatEmbedLead = lead;
        sessionStore.pushLead(lead as unknown as Record<string, unknown>);

        visitorInfo = await createVisitor(
          sanitizeInput(lead.name),
          sanitizeInput(lead.email),
          lead.phone,
          sanitizeInput(lead.zip),
          config,
        );
        sessionStore.updateSession({ visitorInfo });

        // Send lead info as first message
        handleSend(`${lead.name} ${lead.email} ${lead.phone} ${lead.zip}`);
      }

      setupChatInput();
      if (welcomeMessage) saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
      loadMessages();
    });

    // Hide all widget content, show form
    messagesEl.style.display = 'none';
    scrollBtn.style.display = 'none';
    if (quickQuestionsEl) quickQuestionsEl.style.display = 'none';
    poweredBy.style.display = 'none';
    widget.appendChild(formEl);
  }

  function setupChatInput(): void {
    inputBar.container.style.display = 'flex';
  }

  // --- Initial load ---
  function maybeShowLeadCapture(): void {
    if (!leadCapture) {
      window.__simpleChatEmbedLeadCaptured = true;
      setupChatInput();

      createVisitor(null, null, null, null, config).then((vi) => {
        visitorInfo = vi;
        sessionStore.updateSession({ visitorInfo });
        if (welcomeMessage) saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
        loadMessages();
        connectWebSocket();
      }).catch(() => {
        if (welcomeMessage) saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
        loadMessages();
        connectWebSocket();
      });
      return;
    }

    // Existing session? Skip form
    if (sessionStore.hasExistingSession()) {
      window.__simpleChatEmbedLeadCaptured = true;
      const session = sessionStore.getSession();
      if (session) {
        visitorInfo = session.visitorInfo || null;
        if (session.handoverOccurred) isHandoverActive = true;
      }
      setupChatInput();
      loadMessages();
      setTimeout(() => forceScrollToBottom(), 200);
      connectWebSocket();
      return;
    }

    if (!window.__simpleChatEmbedLeadCaptured) {
      inputBar.container.style.display = 'none';
      showLeadForm();
    } else {
      setupChatInput();
      loadMessages();
    }
  }

  function checkAndAutoConnect(): void {
    const session = sessionStore.getSession();
    if (session?.chatID && session?.visitorInfo) {
      visitorInfo = session.visitorInfo;
      if (!ws.connected) connectWebSocket();
    }
  }

  // For inline mode, show immediately
  if (config.mode === 'inline') {
    widget.style.display = 'flex';
    widget.classList.add('mcx-widget--open');
  }

  maybeShowLeadCapture();
  setTimeout(checkAndAutoConnect, 100);

  // --- Global API ---
  window.openChat = () => {
    if (config.mode === 'inline') return;
    if (!chatOpen) handleToggle();
  };
  window.closeChat = () => {
    if (config.mode === 'inline') return;
    if (chatOpen) handleClose();
  };
  window.toggleChat = () => {
    if (config.mode === 'inline') return;
    handleToggle();
  };
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
