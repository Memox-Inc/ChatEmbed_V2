/**
 * Safe DOM builders for rich component renderers (MMX-179).
 *
 * CONTRACT: el() and svg() are the ONLY functions renderers use to produce DOM.
 * No renderer may write to element.innerHTML with untrusted data.
 * Text content always flows through text() or the children array.
 *
 * This module intentionally omits the innerHTML shortcut that src/utils/dom.ts
 * exposes. Renderer modules must import from this file, not from utils/dom.ts.
 */

type Attrs = Record<string, string>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: Array<Node | string>,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') {
        element.className = v;
      } else {
        element.setAttribute(k, v);
      }
    }
  }
  if (children) {
    for (const child of children) {
      element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return element;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: Array<SVGElement | Node>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElementTagNameMap[K];
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      element.setAttribute(k, v);
    }
  }
  if (children) {
    for (const child of children) element.appendChild(child);
  }
  return element;
}

export function text(content: string): Text {
  return document.createTextNode(content);
}

/** Append children to an existing element. */
export function append(parent: Element, ...children: Array<Node | string>): void {
  for (const child of children) {
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}
