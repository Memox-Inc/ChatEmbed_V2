import DOMPurify from 'dompurify';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') {
        element.className = v;
      } else if (k === 'innerHTML') {
        element.innerHTML = v;
      } else if (k === 'innerText') {
        element.innerText = v;
      } else {
        element.setAttribute(k, v);
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }
  return element;
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'style'],
    ADD_TAGS: ['svg', 'path', 'circle', 'line', 'polyline', 'rect', 'g', 'defs', 'clipPath'],
  });
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function sanitizeInput(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  );
}
