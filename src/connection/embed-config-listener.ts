/**
 * Live embed-config listener.
 *
 * Opens a read-only WebSocket to ``ws/embed/<embed_id>/`` so the widget
 * receives ``embed_config_updated`` events whenever an operator saves
 * new config in the dashboard. The handler re-applies CSS theme
 * variables in place — no page reload, no chat disruption.
 *
 * Reconnects with exponential backoff (cap 30 s). Bails out cleanly
 * when ``embedId`` is unset (falsy ⇒ legacy widget that doesn't want
 * live updates).
 *
 * Boot-time launcher / attractor / welcome config still comes from the
 * one-shot ``fetchInitConfig`` HTTP call; this listener layers on top
 * to push subsequent edits without forcing a page reload.
 */
import type { ChatEmbedConfig, Theme } from '../config/types';
import { applyTheme } from '../ui/theme-vars';

interface EmbedConfigUpdatePayload {
  type: 'embed_config_updated';
  config?: {
    title?: string;
    welcome_message?: string;
    theme?: Theme;
    launcher?: Record<string, unknown>;
    lead_capture?: { enabled?: boolean; mandatory?: boolean };
    quick_questions?: string[];
    attractor_variant?: string;
  };
}

export interface EmbedConfigListenerHandle {
  stop: () => void;
}

const RECONNECT_BACKOFF_START_MS = 1000;
const RECONNECT_BACKOFF_MAX_MS = 30000;

export function startEmbedConfigListener(
  config: ChatEmbedConfig,
  root: ShadowRoot,
  onApply?: (payload: EmbedConfigUpdatePayload['config']) => void,
): EmbedConfigListenerHandle {
  const embedId = config.embedId;
  if (!embedId) {
    return { stop: () => undefined };
  }

  const wsBase = deriveWsBase(config);
  if (!wsBase) {
    return { stop: () => undefined };
  }

  const url = `${wsBase.replace(/\/$/, '')}/ws/embed/${encodeURIComponent(embedId)}/`;
  let socket: WebSocket | null = null;
  let stopped = false;
  let backoff = RECONNECT_BACKOFF_START_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = (): void => {
    if (stopped) return;
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      backoff = RECONNECT_BACKOFF_START_MS;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}') as EmbedConfigUpdatePayload;
        if (data && data.type === 'embed_config_updated' && data.config) {
          applyTheme(root, data.config.theme as Theme | undefined);
          if (onApply) onApply(data.config);
        }
      } catch {
        // Ignore malformed frames — analytics-only channel, can't break the widget.
      }
    };

    socket.onclose = () => {
      socket = null;
      scheduleReconnect();
    };

    socket.onerror = () => {
      // Let onclose handle reconnect bookkeeping.
    };
  };

  const scheduleReconnect = (): void => {
    if (stopped) return;
    if (reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      backoff = Math.min(backoff * 2, RECONNECT_BACKOFF_MAX_MS);
      connect();
    }, backoff);
  };

  connect();

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        try { socket.close(); } catch { /* noop */ }
      }
    },
  };
}

function deriveWsBase(config: ChatEmbedConfig): string | null {
  if (config.socketUrl) {
    return config.socketUrl.replace(/\/?ws\/app\/?$/, '');
  }
  if (config.baseUrl) {
    try {
      const u = new URL(config.baseUrl);
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${u.host}`;
    } catch {
      return null;
    }
  }
  return null;
}
