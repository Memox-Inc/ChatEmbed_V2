export function createThinkingIndicator(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'mcx-thinking';
  el.innerHTML = `
    <div class="mcx-avatar mcx-avatar--bot" style="border-radius:8px;background:#E2E8F0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
    </div>
    <div class="mcx-th-bubble">
      <div class="mcx-th-shimmer"></div>
      <span class="mcx-th-text">Thinking...</span>
    </div>
  `;

  // Switch text after 1.4s
  setTimeout(() => {
    const text = el.querySelector('.mcx-th-text');
    if (text) text.textContent = 'Analyzing...';
  }, 1400);

  return el;
}
