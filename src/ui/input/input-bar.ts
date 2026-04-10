export interface InputBarRefs {
  container: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  setDisabled: (disabled: boolean) => void;
  setBotResponding: (responding: boolean) => void;
}

export function createInputBar(onSend: (text: string) => void): InputBarRefs {
  const container = document.createElement('div');
  container.className = 'mcx-input-area';

  const textarea = document.createElement('textarea');
  textarea.className = 'mcx-textarea';
  textarea.placeholder = 'Type your message...';
  textarea.rows = 1;

  const sendBtn = document.createElement('button');
  sendBtn.className = 'mcx-send-btn';
  sendBtn.disabled = true;
  sendBtn.title = 'Send';
  sendBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';

  // Auto-resize textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
    const hasText = textarea.value.trim().length > 0;
    sendBtn.disabled = !hasText;
  });

  // Enter to send (shift+enter for newline)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = textarea.value.trim();
      if (val && !sendBtn.disabled) {
        onSend(val);
        textarea.value = '';
        textarea.style.height = 'auto';
        sendBtn.disabled = true;
      }
    }
  });

  sendBtn.addEventListener('click', () => {
    const val = textarea.value.trim();
    if (val) {
      onSend(val);
      textarea.value = '';
      textarea.style.height = 'auto';
      sendBtn.disabled = true;
    }
  });

  container.appendChild(textarea);
  container.appendChild(sendBtn);

  function setDisabled(disabled: boolean): void {
    textarea.disabled = disabled;
    sendBtn.disabled = disabled;
    container.classList.toggle('mcx-input-area--disabled', disabled);
  }

  function setBotResponding(responding: boolean): void {
    if (responding) {
      textarea.disabled = true;
      sendBtn.disabled = true;
      container.classList.add('mcx-input-area--responding');
    } else {
      textarea.disabled = false;
      if (textarea.value.trim()) sendBtn.disabled = false;
      container.classList.remove('mcx-input-area--responding');
      textarea.focus();
    }
  }

  return { container, textarea, sendBtn, setDisabled, setBotResponding };
}
