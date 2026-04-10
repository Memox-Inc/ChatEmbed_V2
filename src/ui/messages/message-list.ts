export function createMessageList(): {
  messagesEl: HTMLDivElement;
  scrollToBottom: () => void;
  forceScrollToBottom: () => void;
  checkScrollPosition: () => void;
  scrollBtn: HTMLButtonElement;
} {
  const messagesEl = document.createElement('div');
  messagesEl.className = 'mcx-messages';

  const scrollBtn = document.createElement('button');
  scrollBtn.className = 'mcx-scroll-btn';
  scrollBtn.title = 'Scroll to bottom';
  scrollBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 13 5 5 5-5"/><path d="M12 18V6"/></svg>';

  function scrollToBottom(): void {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function checkScrollPosition(): void {
    const threshold = 100;
    const isBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + threshold;
    scrollBtn.style.display = isBottom ? 'none' : 'flex';
  }

  function forceScrollToBottom(): void {
    let attempts = 0;
    const maxAttempts = 5;
    function tryScroll(): void {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      attempts++;
      if (attempts < maxAttempts && messagesEl.scrollTop < messagesEl.scrollHeight - messagesEl.clientHeight - 10) {
        setTimeout(tryScroll, 50);
      } else {
        checkScrollPosition();
      }
    }
    tryScroll();
  }

  messagesEl.addEventListener('scroll', checkScrollPosition);

  scrollBtn.addEventListener('click', () => {
    scrollToBottom();
    scrollBtn.style.display = 'none';
  });

  return { messagesEl, scrollToBottom, forceScrollToBottom, checkScrollPosition, scrollBtn };
}
