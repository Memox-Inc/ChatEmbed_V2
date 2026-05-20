export function createThinkingIndicator(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'mcx-thinking';
  el.innerHTML = `
    <div class="mcx-avatar mcx-avatar--bot" style="border-radius:8px;background:#E2E8F0">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#6366f1" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle class="antenna-ball" cx="12" cy="2.5" r="0.9" fill="#6366f1" stroke="none"/><path d="M12 3.4v2.1"/><circle class="cable-bead" cx="12" cy="4.45" r="0.45" fill="#6366f1" stroke="none"/><rect x="4" y="5.5" width="16" height="14" rx="4"/><circle class="eye-left" cx="9" cy="12" r="1.2" fill="#6366f1" stroke="none"/><circle class="eye-right" cx="15" cy="12" r="1.2" fill="#6366f1" stroke="none"/><path class="smile" d="M10.5 16q1.5 0.8 3 0" stroke-width="1.4" fill="none"/></svg>
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
