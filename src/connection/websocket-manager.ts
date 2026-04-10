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
}

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private config: ChatEmbedConfig;
  private onMessage: MessageHandler;

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

    const browserMetadata = collectBrowserMetadata();
    const socketUrl = this.config.socketUrl + '/ws/app/';
    const agentParam = this.config.agent_id ? `&agent_id=${this.config.agent_id}` : '';
    const wsUrl = `${socketUrl}${this.config.org_id}/?visitor_info=${JSON.stringify(visitorInfo)}&browser_metadata=${encodeURIComponent(JSON.stringify(browserMetadata))}${agentParam}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this._connected = true;
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
        console.error('WebSocket connection closed unexpectedly...');
        this.cleanup();
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
