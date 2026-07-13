import { robotSvg } from '../robot-svg';

export function createThinkingIndicator(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'mcx-thinking';
  el.innerHTML = `
    <div class="mcx-avatar mcx-avatar--bot" style="border-radius:8px;background:#E2E8F0">
      ${robotSvg('13', '#6366f1')}
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
