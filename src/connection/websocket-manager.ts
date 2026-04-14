import type { ChatEmbedConfig, VisitorInfo } from '../config/types';
import { collectBrowserMetadata } from './browser-metadata';

export type MessageHandler = (data: WsMessageData) => void;

export interface WsMessageData {
  room_name?: string;
  message_type?: string;
  sender_type?: string;
  sender?: string | { name?: string };
  content?: string;
  message?: string;
  message_id?: string;
  is_complete?: boolean;
  created_at?: string;
  sender_name?: string;
  assigned_user_name?: string;
  assigned_user_email?: string;
}

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private config: ChatEmbedConfig;
  private onMessage: MessageHandler;
  private lastVisitorInfo: VisitorInfo | null = null;
  private lastChatID: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private intentionallyClosed = false;

  get connected(): boolean {
    return this._connected;
  }

  get readyState(): number | undefined {
    return this.socket?.readyState;
  }

  constructor(config: ChatEmbedConfig, onMessage: MessageHandler) {
    this.config = config;
    this.onMessage = onMessage;
  }

  connect(visitorInfo: VisitorInfo | null, chatID: string): void {
    if (this._connected || this.socket) return;
    this.lastVisitorInfo = visitorInfo;
    this.lastChatID = chatID;
    this.intentionallyClosed = false;

    const browserMetadata = collectBrowserMetadata();
    const socketUrl = this.config.socketUrl + '/ws/app/';
    const agentParam = this.config.agent_id ? `&agent_id=${this.config.agent_id}` : '';
    const wsUrl = `${socketUrl}${this.config.org_id}/?visitor_info=${JSON.stringify(visitorInfo)}&browser_metadata=${encodeURIComponent(JSON.stringify(browserMetadata))}${agentParam}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this._connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as WsMessageData;
          this.onMessage(data);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      this.socket.onclose = () => {
        this.cleanup();
        if (!this.intentionallyClosed) {
          this.tryReconnect();
        }
      };

      this.socket.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        this.cleanup();
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.cleanup();
    }
  }

  send(data: Record<string, unknown>): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  close(): void {
    this.intentionallyClosed = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this._connected = false;
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (!this.lastVisitorInfo || !this.lastChatID) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    setTimeout(() => {
      if (!this._connected && !this.intentionallyClosed) {
        this.connect(this.lastVisitorInfo, this.lastChatID!);
      }
    }, delay);
  }

  private cleanup(): void {
    this._connected = false;
    this.socket = null;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startHeartbeat(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const heartbeatMessage = {
      message_type: 'heartbeat',
      timestamp: Date.now(),
    };
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(heartbeatMessage));
      } else {
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
      }
    }, 2500);
  }
}
