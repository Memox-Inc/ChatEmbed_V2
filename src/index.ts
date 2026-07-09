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
import { createSessionEndedToast, type SessionEndedToastHandle } from './ui/messages/session-ended-toast';
import { StreamingRenderer } from './ui/messages/streaming-renderer';
import { createInputBar } from './ui/input/input-bar';
import { createQuickQuestions } from './ui/input/quick-questions';
import { createLeadCaptureForm, type LeadData } from './ui/forms/lead-capture-form';
import { createLauncher } from './ui/launcher';
import { mountTeaser } from './ui/attractors/teaser';
import { applyPulse } from './ui/attractors/pulse';
import { mountBadge } from './ui/attractors/badge';
import type { AttractorHandle } from './ui/attractors/types';
import { mountSmartAutoOpen, type SmartAutoOpenHandle } from './ui/attractors/smart-auto-open';
import { mountPersonaCard } from './ui/attractors/persona-card';
import { pickPrimaryAttractor } from './ui/attractors/pick-primary';
import { createOpenTriggerStore } from './ui/open-trigger';
import { normalizePhoneE164 } from './ui/forms/validation';
import * as analytics from './analytics/posthog';
import { postEmbedEvent } from './analytics/embed-events';
import { getOrCreateDistinctId } from './utils/distinct-id';
import { fetchInitConfig, normalizeServerConfig } from './connection/init';
import { applyTheme } from './ui/theme-vars';
import { startEmbedConfigListener } from './connection/embed-config-listener';

declare global {
  interface Window {
    SimpleChatEmbedConfig?: Partial<ChatEmbedConfig>;
    MemoxChatConfig?: Partial<ChatEmbedConfig>;
    SimpleChatEmbedLead?: LeadData;
    __simpleChatEmbedLeadCaptured?: boolean;
    openChat?: () => void;
    closeChat?: () => void;
    toggleChat?: () => void;
    MemoxChatWidget?: {
      destroy: () => void;
    };
  }
}

async function init(): Promise<void> {
  const userConfig = window.MemoxChatConfig || window.SimpleChatEmbedConfig || {};
  // Fetch server-side launcher + attractor config before merging. The
  // server is the source of truth for ``launcher`` and ``attractor_variant``;
  // local config provides everything else. Falls through to {} on failure
  // so the widget always boots with at least the local defaults.
  const localConfig = mergeConfig(defaultConfig, userConfig);
  // Production hub hostname. ``api.memox.io`` does not resolve — confirmed
  // against ``repos/memox-hub/deploy/k8s/README.md`` (Prod: hub.memox.io,
  // Dev: hub-dev.memox.io). Without this default a customer pasting only
  // ``embedId`` would silently fail DNS on every init request.
  const apiBase = localConfig.apiBase || localConfig.apiUrl || 'https://hub.memox.io';
  const serverConfig = await fetchInitConfig(
    localConfig.embedId ?? null,
    apiBase,
    localConfig.disableExperiments,
  );
  const config = mergeConfig(localConfig, serverConfig as Partial<ChatEmbedConfig>);
  // Scope localStorage to this embed instance — must run before any
  // sessionStore reads/writes so multiple widgets on the same origin
  // (marketing site widget + per-persona demo embed) don't share state.
  sessionStore.setNamespace(config.storageNamespace);
  // Wire PostHog analytics (no-op when ``memoxPosthogApiKey`` is unset).
  // attractor_variant is read from the server's init response so every event
  // can be split by launcher variant in PostHog funnels.
  // ``chat_widget_loaded`` is captured at the end of init() instead of here
  // to ensure the event reflects a successfully bootstrapped widget.
  analytics.init({
    apiKey: config.memoxPosthogApiKey,
    host: config.memoxPosthogHost,
    orgId: config.org_id ?? null,
    agentId: config.agent_id ?? null,
    attractorVariant: (serverConfig as Record<string, unknown>).attractor_variant as string | null | undefined,
  });
  // Tag every PostHog event with the experiment assignment from /embed/init
  // so PostHog funnel analysis can group events by variant. This is OPTIONAL
  // telemetry only: Memox Optimize counts impressions/conversions in-platform
  // from ExperimentAssignment rows, not from these tags. Must run BEFORE the
  // first capture() (chat_widget_loaded) below. Skipped when disableExperiments
  // is true so uncontested visitors are never bucketed or tagged.
  if (!config.disableExperiments) {
    const experiments = (serverConfig as Record<string, unknown>).experiments;
    if (Array.isArray(experiments) && experiments.length > 0) {
      analytics.setExperimentTags(
        experiments as import('./analytics/posthog').ExperimentAssignment[],
      );
    }
  }
  const theme = config.theme || {};
  const welcomeMessage = config.welcomeMessage || null;
  const welcomeMessageStyle = config.welcomeMessageStyle as WelcomeMessageStyle | undefined;
  // ``leadCapture`` is now boolean | LeadCaptureConfig (MMX-575). For the
  // gating reads below ("show the form?") all callers care about is the
  // master toggle, so collapse to a boolean once at boot time. Default to
  // ``true`` when unset so self-hosted callers that omit config get the
  // classic experience.
  const leadCaptureRaw = config.leadCaptureConfig ?? config.leadCapture;
  const leadCapture =
    typeof leadCaptureRaw === 'boolean' ? leadCaptureRaw :
    leadCaptureRaw === undefined ? true :
    !!(leadCaptureRaw as { enabled?: boolean }).enabled;

  // State
  let visitorInfo: VisitorInfo | null = null;
  let chatID: string | null = null;
  let isHandoverActive = false;
  // MMX-551: signed R2/S3 URL for the assigned sales rep's profile
  // photo. Captured from the handover_message WS frame and reused on
  // every subsequent rep text message in the session so the avatar
  // doesn't flicker back to the default icon mid-conversation.
  let currentRepPhotoUrl: string | null = null;
  let isFormShowing = false;
  let isBotResponding = false;
  let chatOpen = false;
  // Session-close idempotency. ``showSessionClosedNotification`` is reachable
  // from three independent paths (REST validate on connect, REST validate on
  // widget toggle, inbound WS ``error_message``). Without a single gate, each
  // path schedules its own 3s ``resetSession`` timer, producing stacked
  // banners and stacked lead forms in one widget. Cleared at the end of
  // ``resetSession``. MMX-573.
  let sessionClosePending = false;
  // Handle for the active session-ended toast so ``resetSession`` (and a
  // racing second close trigger) can dispose its countdown interval.
  let sessionEndedToast: SessionEndedToastHandle | null = null;
  // Timer that drives the reset after the countdown elapses — tracked so a
  // "Start now" click can cancel it and reset immediately.
  let sessionResetTimer: ReturnType<typeof setTimeout> | null = null;
  const SESSION_END_COUNTDOWN_SEC = 3;

  // --- Shadow DOM setup ---
  let root: ShadowRoot;
  let host: HTMLElement;

  if (config.mode === 'inline') {
    // For inline mode, find parent container by selector, ID convention, or script tag's parent
    let parent: HTMLElement | null = null;
    if (config.parentSelector) {
      parent = document.querySelector<HTMLElement>(config.parentSelector);
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

  // --- Theme variable overrides ---
  // The base stylesheet hardcodes ``--p`` / ``--ph`` on ``:host`` for
  // the launcher gradient, header gradient, send button, focus rings,
  // etc. ``theme.primary`` only lands on those surfaces if we inject
  // overrides. ``applyTheme`` is also reused by the live-update WS
  // listener below — single source of truth.
  applyTheme(root, theme);

  // --- Live config propagation ---
  // When ``embedId`` is set, the widget opens a read-only WS to
  // ``/ws/embed/<embed_id>/`` and re-applies CSS theme + welcome on
  // every operator save. No-op when ``embedId`` is unset (e.g.
  // self-hosted/OSS deployments).
  const embedConfigListener = startEmbedConfigListener(config, root, (next) => {
    if (!next) return;
    // Run every server payload through the same normalizer the boot
    // path uses, then mutate the in-memory config so a future panel
    // open (or a future read) picks up every changed field — welcome
    // message, lead capture, quick questions, theme keys, anything
    // the server adds tomorrow. We deliberately don't remount the
    // panel mid-conversation; live updates apply on next open.
    const normalized = normalizeServerConfig(next as unknown as Record<string, any>);
    Object.assign(config, normalized);
  });

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
      config.quickQuestionsPermanent !== false,
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
  let clearBadge: AttractorHandle = { cleanup: () => {} };
  let autoOpenHandle: SmartAutoOpenHandle | null = null;
  // Collect all mounted attractor handles so destroy() can clean them up.
  const mountedAttractors: AttractorHandle[] = [];
  // Carries the pending open trigger from the smart-auto-open callback into
  // handleToggle(). consume() reads + clears atomically so stale values can't
  // leak into subsequent manual opens (HARD-6).
  const triggerStore = createOpenTriggerStore();
  if (config.mode !== 'inline') {
    launcher = createLauncher(config, handleToggle);
    mountedAttractors.push(applyPulse(launcher, config));
    clearBadge = mountBadge(launcher, config);
    mountedAttractors.push(clearBadge);
    root.appendChild(launcher);

    // ── Attractor precedence ──────────────────────────────────────────
    // Only ONE primary attractor (teaser OR persona card) may render at
    // a time. Rules are encoded in pickPrimaryAttractor() (pick-primary.ts)
    // and tested independently — see HARD-8.
    //
    // Adding a future attractor? Edit pickPrimaryAttractor(), not here.
    // ─────────────────────────────────────────────────────────────────
    const primary = pickPrimaryAttractor(config.launcher);
    if (primary === 'persona') {
      mountedAttractors.push(
        mountPersonaCard(config, root as unknown as HTMLElement, {
          onOpen: () => {
            if (!chatOpen) handleToggle();
          },
          onChipClick: (label) => {
            // Defer until the open animation has settled so the input is
            // visible and focusable.
            setTimeout(() => inputBar.setValue(label), 220);
          },
        }),
      );
    } else if (primary === 'teaser') {
      mountedAttractors.push(mountTeaser(config, root as unknown as HTMLElement));
    }
    // primary === null → mount neither

    // Smart auto-open: opens the chat once per session when both time
    // and scroll thresholds are met. The handle exposes
    // notifyManualOpen() so handleToggle can suppress a pending auto-fire
    // when the visitor clicks the launcher first.
    autoOpenHandle = mountSmartAutoOpen(config, () => {
      triggerStore.set('auto_open');
      handleToggle();
    });
    mountedAttractors.push(autoOpenHandle);
  }

  // Close-on-outside-click (floating mode only). Inline mode stays
  // mounted inside the page layout — clicking elsewhere on the demo
  // page should not collapse the chat.
  //
  // The widget + launcher live inside a closed shadow root, so any
  // click inside the chat panel is *retargeted* to the shadow host
  // element on its way up to ``document``. ``widget.contains(target)``
  // returns false in that case (the host is the shadow boundary, not
  // the panel) and the chat closed on every input click. Test against
  // ``host`` instead — that's the actual element ``event.target``
  // resolves to for any click inside the shadow tree.
  // Capture the listener as a named const so destroy() can remove it.
  const onDocumentMouseDown = (event: MouseEvent): void => {
    if (!chatOpen) return;
    const target = event.target as Node | null;
    if (!target) return;
    // Click landed on (or inside) the shadow host → it's our chat.
    if (host.contains(target) || target === host) return;
    handleClose();
  };
  if (config.mode !== 'inline' && config.closeOnOutsideClick !== false) {
    document.addEventListener('mousedown', onDocumentMouseDown);
  }

  // Public destroy() — removes the mousedown listener, cleans up every
  // mounted attractor handle, closes the app WebSocket + embed-config
  // listener (MMX-928: both used to leak past destroy(), leaving a zombie
  // instance whose stray WS frames raced a freshly booted instance on the
  // shared localStorage message array), and detaches the shadow host from
  // the DOM. Safe to call multiple times.
  const destroy = (): void => {
    document.removeEventListener('mousedown', onDocumentMouseDown);
    for (const handle of mountedAttractors) {
      try {
        handle.cleanup();
      } catch (e) {
        console.warn('MemoxChatWidget: attractor cleanup failed', e);
      }
    }
    mountedAttractors.length = 0;
    try {
      ws.close();
    } catch (e) {
      console.warn('MemoxChatWidget: websocket close failed', e);
    }
    try {
      embedConfigListener.stop();
    } catch (e) {
      console.warn('MemoxChatWidget: embed-config listener stop failed', e);
    }
    host.remove();
  };
  window.MemoxChatWidget = { destroy };

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

  let renderedCount = 0; // Track how many messages are rendered in DOM

  function loadMessages(forceFullRender = false): void {
    const msgs = sessionStore.getMessages();

    // Check handover
    if (msgs.some((m) => m.isSystemNotification && m.notificationType === 'joined')) {
      isHandoverActive = true;
    }

    if (forceFullRender || renderedCount === 0) {
      // Full re-render — only on first load, reset, or explicit request
      messagesEl.innerHTML = '';
      renderedCount = 0;
    }

    // Remove quick questions temporarily (will re-append at end)
    if (quickQuestionsEl && quickQuestionsEl.parentElement === messagesEl) {
      messagesEl.removeChild(quickQuestionsEl);
    }

    // Only render NEW messages (incremental append)
    for (let i = renderedCount; i < msgs.length; i++) {
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
        renderedCount++;
        continue;
      }

      const { container, contentWrapper } = createMessageBubble(
        msg,
        config,
        isLast,
        welcomeMessageStyle,
      );
      messagesEl.appendChild(container);
      renderedCount++;

      // Track streaming element
      if (msg.isStreaming && isLast && contentWrapper) {
        streamingRenderer.setActiveElement(contentWrapper);
        streamingRenderer.setText(msg.text);
      }
    }

    // Quick questions
    if (quickQuestionsEl) {
      messagesEl.appendChild(quickQuestionsEl);
      if (config.quickQuestionsPermanent !== false) {
        quickQuestionsEl.style.display = 'flex';
      } else {
        const isFirstSession = msgs.length === 0 || (msgs.length === 1 && msgs[0].isWelcomeMessage);
        quickQuestionsEl.style.display = isFirstSession ? 'flex' : 'none';
      }
    }

    requestAnimationFrame(() => {
      scrollToBottom();
      checkScrollPosition();
    });
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

      // Only validate sessions that have actually been used (i.e. the
      // visitor has exchanged messages — not just the auto-pushed
      // welcome bubble). A fresh chatID was just minted and the server
      // creates its row on the first WS message, so a GET would always
      // 404 and spam the console.
      if (sessionStore.hasServerSyncedMessages()) {
        const result = await validateSession(chatID, config);
        if (result === 'closed') {
          showSessionClosedNotification('This chat session has been closed.');
          return;
        }
        if (result === 'orphaned') {
          // Cached chatID points at a session the server doesn't have
          // (DB reset, cleanup, etc.). Drop the stale state and let the
          // ``if (!chatID)`` block below mint a fresh id — otherwise the
          // dead UUID re-validates on every reload and 404s the console.
          sessionStore.clearAll();
          chatID = null;
          visitorInfo = null;
        }
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

      // MMX-551: stash the rep's signed photo URL so every subsequent
      // 'sales_rep' message bubble renders the actual avatar. Empty
      // string is the explicit "no photo set" signal — keep the
      // default colored icon fallback in that case.
      if (typeof data.sender_photo_url === 'string') {
        currentRepPhotoUrl = data.sender_photo_url || '';
      }

      const senderName = data.assigned_user_name
        || (typeof data.sender === 'object' ? data.sender?.name : null)
        || data.sender_name
        || String(data.sender || 'Sales Representative');
      sessionStore.pushMessage({
        text: `${senderName} has joined the conversation`,
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

      // Remove typing indicator from storage AND DOM
      if (lastMessage && lastMessage.text === '' && (lastMessage.sender === 'bot' || lastMessage.sender === 'ai')) {
        msgs.pop();
        sessionStore.setMessages(msgs);
        // Remove the typing indicator DOM element (last msg-group before quick questions)
        const groups = messagesEl.querySelectorAll('.mcx-msg-group');
        if (groups.length > 0) {
          const lastGroup = groups[groups.length - 1];
          lastGroup.remove();
          renderedCount = Math.max(0, renderedCount - 1);
        }
        lastMessage = msgs[msgs.length - 1] || null;
      }

      const content = data.content || data.message || '';

      // Deduplicate
      if (streamingRenderer.isDuplicateChunk(content)) return;

      // Completion signal — just mark as done, no re-render needed
      if (data.is_complete === true && content === '') {
        if (lastMessage?.isStreaming) {
          lastMessage.isStreaming = false;
          msgs[msgs.length - 1] = lastMessage;
          sessionStore.setMessages(msgs);
          streamingRenderer.reset();
          // No loadMessages() — the streamed text is already in the DOM
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
            // Active element is connected — just update text
            streamingRenderer.setText(lastMessage.text);
            streamingRenderer.scheduleUpdate();
          } else {
            // Element lost (detached from DOM) — recover from DOM without full re-render
            const allBubbles = messagesEl.querySelectorAll('.mcx-bubble--bot');
            const lastBubble = allBubbles[allBubbles.length - 1];
            const contentDiv = lastBubble?.querySelector('div') || lastBubble;
            if (contentDiv) {
              streamingRenderer.setActiveElement(contentDiv as HTMLDivElement);
              streamingRenderer.setText(lastMessage.text);
              streamingRenderer.scheduleUpdate();
            }
            // If still can't find it, do nothing — next chunk will retry.
            // Never call loadMessages() during streaming to avoid flash.
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

      // MMX-551: capture the latest signed photo URL so subsequent
      // rep messages on this session render with the same avatar.
      if (typeof data.sender_photo_url === 'string' && data.sender_photo_url) {
        currentRepPhotoUrl = data.sender_photo_url;
      }

      sessionStore.pushMessage({
        text: content,
        sender: 'sales_rep',
        senderName: (typeof data.sender === 'string' ? data.sender : data.sender_name) || 'Sales Representative',
        senderPhotoUrl: currentRepPhotoUrl || undefined,
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

    // Typing indicator (only when no handover)
    if (!isHandoverActive) {
      saveMessage('', 'bot');
      setBotResponding(true);
    }

    // Single incremental render for both user message + typing indicator
    loadMessages();

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

  function showSessionClosedNotification(_message: string): void {
    // Idempotent: REST validate-session can fire concurrently with a WS
    // ``error_message`` for the same expired session. Without this gate
    // each path would mount its own toast + reset timer, stacking banners
    // and forms. MMX-573.
    if (sessionClosePending) return;
    sessionClosePending = true;

    // Disable input so the visitor can't keep typing into a dead session.
    inputBar.setDisabled(true);

    // Mount the friendly session-ended toast directly into the messages
    // list. Not pushed through ``sessionStore.pushMessage`` because this
    // is an ephemeral, interactive UI element — not part of the
    // transcript that should be replayed on reload.
    sessionEndedToast = createSessionEndedToast(SESSION_END_COUNTDOWN_SEC, () => {
      // Triggered either by countdown finishing or "Start now" click.
      if (sessionResetTimer !== null) {
        clearTimeout(sessionResetTimer);
        sessionResetTimer = null;
      }
      resetSession();
    });
    messagesEl.appendChild(sessionEndedToast.element);
    // Ensure the toast is visible without forcing the user to scroll.
    // Guard: ``scrollIntoView`` is not implemented in jsdom tests.
    if (typeof sessionEndedToast.element.scrollIntoView === 'function') {
      sessionEndedToast.element.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    // Belt-and-braces reset timer in case the toast's interval is paused
    // by the browser (background tab) or fails. The toast itself fires
    // ``onAdvance`` at the end of the countdown which clears this timer.
    sessionResetTimer = setTimeout(() => {
      sessionResetTimer = null;
      resetSession();
    }, (SESSION_END_COUNTDOWN_SEC + 1) * 1000);
  }

  function handleRefresh(): void {
    if (isFormShowing) return;

    const msgs = sessionStore.getMessages();
    const wasHandover = msgs.some((m) => m.isSystemNotification && m.notificationType === 'joined');
    const session = sessionStore.getSession();
    const sessionHandover = session?.handoverOccurred === true;

    sessionStore.clearMessages();
    renderedCount = 0;
    isHandoverActive = wasHandover || sessionHandover;

    setupChatInput();
    // Welcome message only renders when leadCapture is off — when the form
    // is on, the lead-capture flow takes the place of the greeting and
    // pushing both produces a confusing double-greeting after refresh.
    if (welcomeMessage && !leadCapture) saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
    loadMessages(true);
  }

  function handleClearSession(): void {
    if (isFormShowing) return;
    resetSession();
  }

  function handleClose(): void {
    if (config.mode === 'inline') return;
    chatOpen = false;
    if (launcher) launcher.classList.remove('mcx-launcher--open');
    widget.classList.remove('mcx-widget--open');
    widget.classList.add('mcx-widget--closing');
    setTimeout(() => {
      widget.classList.remove('mcx-widget--closing');
      widget.style.display = 'none';
    }, 200);
    if (launcher) launcher.style.display = 'flex';
  }

  function handleToggle(): void {
    const trigger = triggerStore.consume();
    if (chatOpen) {
      handleClose();
    } else {
      chatOpen = true;
      // Consume the unread-message badge on first open. Subsequent
      // open/close cycles don't restore it — the visit is engaged.
      clearBadge.cleanup();
      // Suppress any pending auto-open if the visitor clicked the
      // launcher manually — the auto-open shouldn't double-fire seconds
      // later when the time threshold finally elapses.
      if (trigger !== 'auto_open') autoOpenHandle?.notifyManualOpen();
      analytics.capture('chat_opened', trigger ? { trigger } : undefined);
      void postEmbedEvent({
        baseUrl: config.baseUrl ?? '',
        embedId: config.embedId ?? '',
        eventType: 'chat_opened',
        distinctId: getOrCreateDistinctId(),
        metadata: trigger ? { trigger } : undefined,
      });
      widget.style.display = 'flex';
      widget.classList.add('mcx-widget--open');
      widget.classList.remove('mcx-widget--closing');
      if (launcher) launcher.classList.add('mcx-launcher--open');
      if (launcher) launcher.style.display = 'none';

      // Validate session on open — skip for fresh sessions whose only
      // message is the auto-pushed welcome (server hasn't created the
      // row yet, GET would 404 and add console noise).
      const session = sessionStore.getSession();
      if (session?.chatID && sessionStore.hasServerSyncedMessages()) {
        validateSession(session.chatID, config).then((result) => {
          if (result === 'closed') {
            showSessionClosedNotification('This chat session has been closed.');
          } else if (result === 'orphaned') {
            sessionStore.clearAll();
          }
        });
      }

      setTimeout(() => forceScrollToBottom(), 150);
    }
  }

  async function resetSession(): Promise<void> {
    // Tear down any active session-ended toast (countdown interval) and
    // belt-and-braces reset timer so they can't fire post-reset.
    if (sessionEndedToast) {
      sessionEndedToast.dispose();
      sessionEndedToast = null;
    }
    if (sessionResetTimer !== null) {
      clearTimeout(sessionResetTimer);
      sessionResetTimer = null;
    }

    sessionStore.clearAll();
    isHandoverActive = false;
    currentRepPhotoUrl = null;
    isFormShowing = false;
    window.__simpleChatEmbedLeadCaptured = false;
    visitorInfo = null;
    chatID = null;
    ws.close();
    inputBar.setDisabled(false);
    messagesEl.innerHTML = '';
    renderedCount = 0;

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
      loadMessages(true);
      connectWebSocket();
    } else {
      inputBar.container.style.display = 'none';
      showLeadForm();
    }
    // Release the close-pending latch only after the fresh session UI is
    // mounted — any close events that landed during this window are
    // collapsed into this single reset. MMX-573.
    sessionClosePending = false;
  }

  function showLeadForm(): void {
    // Idempotent. If a prior lead form is already mounted in the widget,
    // remove it before appending the new one — ``widget.appendChild`` would
    // otherwise stack forms (the form lives on ``widget``, not on
    // ``messagesEl``, so the reset's ``innerHTML = ''`` does not reach it).
    // MMX-573.
    const existingForm = widget.querySelector('.mcx-lead-conv');
    if (existingForm) existingForm.remove();

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
        analytics.capture('chat_lead_captured', {
          has_phone: !!lead.phone,
          has_zip: !!lead.zip,
        });

        // Collect custom fields (f_<nanoid> keys) from lead.values so
        // they flow through to Visitor.metadata on the backend.
        const customFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(lead.values ?? {})) {
          if (k.startsWith('f_')) customFields[k] = v;
        }
        visitorInfo = await createVisitor(
          sanitizeInput(lead.name),
          sanitizeInput(lead.email),
          lead.phone,
          sanitizeInput(lead.zip),
          config,
          Object.keys(customFields).length > 0 ? customFields : undefined,
        );
        sessionStore.updateSession({ visitorInfo });
        void postEmbedEvent({
          baseUrl: config.baseUrl ?? '',
          embedId: config.embedId ?? '',
          eventType: 'form_submitted',
          distinctId: getOrCreateDistinctId(),
          visitorId: typeof visitorInfo?.id === 'number' ? visitorInfo.id : null,
        });

        // PostHog identify + group — links the anonymous visitor to their
        // identified profile and associates them with the org.
        // Guarded by disableExperiments: when consent is withheld, skip
        // all identity-linking calls.
        if (!config.disableExperiments) {
          const identityProps: Record<string, unknown> = {};
          if (lead.email) identityProps.email = lead.email;
          if (lead.name) identityProps.name = lead.name;
          analytics.identify(getOrCreateDistinctId(), identityProps);
          if (config.org_id != null) {
            analytics.group('organization', String(config.org_id), {});
          }
        }
      }

      // Show input but keep disabled until WS connects
      setupChatInput();
      inputBar.setDisabled(true);
      setBotResponding(true);
      loadMessages();
      connectWebSocket();

      // Enable input after WS opens. Bounded by MAX_INIT_RETRIES so a
      // dead socket can't spin forever — surface a user-visible error
      // instead. Once open, fire a ``request_greeting`` control event
      // (server-driven greeting): the backend persists a real bot
      // ChatMessage and broadcasts it through the standard text_message
      // pipeline, so the greeting renders like any other agent reply
      // (visible in admin, operator dashboard, history). No client-side
      // ``saveMessage`` — that would create a phantom bubble that the
      // server never sees.
      const MAX_INIT_RETRIES = 20; // ~6s at 300ms intervals
      let retryCount = 0;
      const enableWhenReady = (): void => {
        if (ws.readyState === WebSocket.OPEN) {
          if (welcomeMessage) {
            ws.send({
              message_type: 'request_greeting',
              greeting_text: welcomeMessage,
              room_name: chatID,
            });
          }
          inputBar.setDisabled(false);
          setBotResponding(false);
        } else if (retryCount < MAX_INIT_RETRIES) {
          retryCount++;
          setTimeout(enableWhenReady, 300);
        } else {
          console.warn('MemoxChatWidget: init timed out after 6s');
          // Show a user-visible inline error so the panel doesn't appear
          // silently frozen with the input bar disabled.
          const errorEl = document.createElement('div');
          errorEl.className = 'mcx-init-error';
          errorEl.textContent = 'Unable to connect. Please refresh the page.';
          // Insert before the input bar so the user sees it in context.
          if (inputBar.container.parentElement) {
            inputBar.container.parentElement.insertBefore(errorEl, inputBar.container);
          } else {
            widget.appendChild(errorEl);
          }
          // Capture observable failure in PostHog so silent frozen panels
          // are surfaced in dashboards.
          analytics.capture('widget_init_timeout', { reason: 'enableWhenReady_max_retries' });
        }
      };
      setTimeout(enableWhenReady, 500);
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
  analytics.capture('chat_widget_loaded');

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

// Auto-initialize when DOM is ready. ``init`` is async (it fetches
// /embed/init before mounting) — swallow rejections so an unexpected
// throw can't take down the host page's JS.
function bootstrap(): void {
  init().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[Memox] widget init failed', e);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
