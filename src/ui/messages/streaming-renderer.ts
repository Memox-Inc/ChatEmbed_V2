import { markdownToHtml } from './markdown-renderer';

export class StreamingRenderer {
  private activeEl: HTMLDivElement | null = null;
  private text = '';
  private rafId: number | null = null;
  private dirty = false;
  private lastChunkContent = '';
  private lastChunkTime = 0;
  private messagesContainer: HTMLElement;
  private botTextColor?: string;

  constructor(messagesContainer: HTMLElement, botTextColor?: string) {
    this.messagesContainer = messagesContainer;
    this.botTextColor = botTextColor;
  }

  get activeElement(): HTMLDivElement | null {
    // Check element is still connected to the DOM
    if (this.activeEl && !this.activeEl.isConnected) {
      this.activeEl = null;
    }
    return this.activeEl;
  }

  setActiveElement(el: HTMLDivElement | null): void {
    this.activeEl = el;
  }

  get currentText(): string {
    return this.text;
  }

  setText(text: string): void {
    this.text = text;
  }

  isDuplicateChunk(content: string): boolean {
    if (content && content === this.lastChunkContent && Date.now() - this.lastChunkTime < 200) {
      return true;
    }
    if (content) {
      this.lastChunkContent = content;
      this.lastChunkTime = Date.now();
    }
    return false;
  }

  appendText(chunk: string): void {
    this.text += chunk;
    this.scheduleUpdate();
  }

  scheduleUpdate(): void {
    this.dirty = true;
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  private flush(): void {
    this.rafId = null;
    if (!this.dirty || !this.activeEl) return;
    this.dirty = false;
    this.activeEl.innerHTML = markdownToHtml(this.text, this.botTextColor);

    // Auto-scroll if near bottom
    const c = this.messagesContainer;
    const isNearBottom = c.scrollHeight - c.scrollTop <= c.clientHeight + 150;
    if (isNearBottom) {
      c.scrollTop = c.scrollHeight;
    }
  }

  reset(): void {
    this.activeEl = null;
    this.text = '';
    this.dirty = false;
    this.lastChunkContent = '';
    this.lastChunkTime = 0;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
