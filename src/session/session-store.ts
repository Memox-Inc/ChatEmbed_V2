import type { StoredMessage, VisitorInfo } from '../config/types';

const KEYS = {
  messages: 'simple-chat-messages',
  session: 'simple-chat-session',
  leads: 'simple-chat-leads',
  userGuid: 'simple-chat-user-guid',
};

export class SessionStore {
  // --- Messages ---
  getMessages(): StoredMessage[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.messages) || '[]');
    } catch {
      return [];
    }
  }

  setMessages(msgs: StoredMessage[]): void {
    localStorage.setItem(KEYS.messages, JSON.stringify(msgs));
  }

  clearMessages(): void {
    localStorage.removeItem(KEYS.messages);
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
      const raw = localStorage.getItem(KEYS.session);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setSession(data: Record<string, unknown>): void {
    localStorage.setItem(KEYS.session, JSON.stringify(data));
  }

  updateSession(patch: Record<string, unknown>): void {
    const current = this.getSession() || {};
    this.setSession({ ...current, ...patch });
  }

  clearSession(): void {
    localStorage.removeItem(KEYS.session);
  }

  // --- Leads ---
  getLeads(): unknown[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.leads) || '[]');
    } catch {
      return [];
    }
  }

  pushLead(lead: Record<string, unknown>): void {
    const leads = this.getLeads();
    leads.push(lead);
    localStorage.setItem(KEYS.leads, JSON.stringify(leads));
  }

  clearLeads(): void {
    localStorage.removeItem(KEYS.leads);
  }

  // --- User GUID ---
  clearUserGuid(): void {
    localStorage.removeItem(KEYS.userGuid);
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
