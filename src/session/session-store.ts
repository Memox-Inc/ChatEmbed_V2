import type { StoredMessage, VisitorInfo } from '../config/types';

const DEFAULT_PREFIX = 'simple-chat';

export class SessionStore {
  private prefix: string = DEFAULT_PREFIX;

  /**
   * Scope all localStorage keys to a custom prefix so multiple chat
   * embeds can coexist on the same origin without sharing visitor /
   * session state. Call this once during init, before any get/set.
   */
  setNamespace(prefix: string | undefined | null): void {
    this.prefix = (prefix && prefix.trim()) || DEFAULT_PREFIX;
  }

  private get KEYS() {
    return {
      messages: `${this.prefix}-messages`,
      session: `${this.prefix}-session`,
      leads: `${this.prefix}-leads`,
      userGuid: `${this.prefix}-user-guid`,
    };
  }

  // --- Messages ---
  getMessages(): StoredMessage[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.messages) || '[]');
    } catch {
      return [];
    }
  }

  setMessages(msgs: StoredMessage[]): void {
    localStorage.setItem(this.KEYS.messages, JSON.stringify(msgs));
  }

  clearMessages(): void {
    localStorage.removeItem(this.KEYS.messages);
  }

  pushMessage(msg: StoredMessage): void {
    const msgs = this.getMessages();
    msgs.push(msg);
    this.setMessages(msgs);
  }

  popLastMessage(): StoredMessage | undefined {
    const msgs = this.getMessages();
    const last = msgs.pop();
    this.setMessages(msgs);
    return last;
  }

  updateLastMessage(updater: (msg: StoredMessage) => StoredMessage): void {
    const msgs = this.getMessages();
    if (msgs.length > 0) {
      msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
      this.setMessages(msgs);
    }
  }

  getLastMessage(): StoredMessage | null {
    const msgs = this.getMessages();
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  }

  // --- Session ---
  getSession(): { chatID?: string; visitorInfo?: VisitorInfo; timestamp?: string; handoverOccurred?: boolean } | null {
    try {
      const raw = localStorage.getItem(this.KEYS.session);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setSession(data: Record<string, unknown>): void {
    localStorage.setItem(this.KEYS.session, JSON.stringify(data));
  }

  updateSession(patch: Record<string, unknown>): void {
    const current = this.getSession() || {};
    this.setSession({ ...current, ...patch });
  }

  clearSession(): void {
    localStorage.removeItem(this.KEYS.session);
  }

  // --- Leads ---
  getLeads(): unknown[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.leads) || '[]');
    } catch {
      return [];
    }
  }

  pushLead(lead: Record<string, unknown>): void {
    const leads = this.getLeads();
    leads.push(lead);
    localStorage.setItem(this.KEYS.leads, JSON.stringify(leads));
  }

  clearLeads(): void {
    localStorage.removeItem(this.KEYS.leads);
  }

  // --- User GUID ---
  clearUserGuid(): void {
    localStorage.removeItem(this.KEYS.userGuid);
  }

  // --- Full reset ---
  clearAll(): void {
    this.clearMessages();
    this.clearSession();
    this.clearLeads();
    this.clearUserGuid();
  }

  // --- Helpers ---
  hasHandoverMessage(): boolean {
    return this.getMessages().some(
      (m) => m.isSystemNotification && m.notificationType === 'joined',
    );
  }

  hasExistingSession(): boolean {
    const msgs = this.getMessages();
    const session = this.getSession();
    return msgs.length > 0 && session !== null;
  }

  /**
   * True only if the visitor has actually exchanged messages with the
   * server in this cached session — i.e. the localStorage state is more
   * than just the always-present welcome bubble. Use this to decide
   * whether revalidating the chatID against the backend is worthwhile;
   * a brand-new session has no server row yet, so a GET would always
   * 404 and pollute the console.
   */
  hasServerSyncedMessages(): boolean {
    return this.getMessages().some((m) => !m.isWelcomeMessage);
  }
}

export const sessionStore = new SessionStore();
