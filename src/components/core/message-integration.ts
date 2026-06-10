import type { WireComponent, RenderCtx, ThemeTokens } from './types';
import { componentRegistry, type ComponentRegistry } from './registry';
import { el, text } from './dom';

/**
 * Escape a value for use inside a double-quoted CSS attribute selector.
 * Equivalent safety to CSS.escape for this use (quote + backslash are the
 * only characters that can break out of a quoted attribute string), but
 * works in jsdom, which does not expose the CSS global.
 * Control characters (U+0000..U+001F) are stripped because they make
 * querySelector throw a SyntaxError in Chrome/jsdom even inside quotes.
 */
function cssAttrEscape(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1f]/g, '').replace(/[\\"]/g, '\\$&');
}

function wrapComponent(comp: WireComponent, renderedEl: HTMLElement): HTMLDivElement {
  const wrapper = el('div', {
    className: 'mcx-component-wrapper',
    'data-component-type': comp.type,
    'data-component-id': comp.id,
  });
  wrapper.appendChild(renderedEl);
  return wrapper;
}

/**
 * Render all components from a message into a wrapper div.
 * Returns null if no components are renderable.
 * Consecutive shopify_product_card runs (2+) are grouped under a carousel
 * layout container. The carousel container carries NO component id; each
 * card keeps its OWN wrapper stamped with its individual data-component-id
 * so applyComponentUpdate addresses grouped and ungrouped components
 * uniformly.
 */
export function renderComponentsBlock(
  components: WireComponent[],
  ctx: RenderCtx,
  registry: ComponentRegistry = componentRegistry,
): HTMLDivElement | null {
  if (!components.length) return null;
  const container = el('div', { className: 'mcx-components-block' });
  let rendered = 0;
  let i = 0;

  while (i < components.length) {
    const comp = components[i];

    if (comp.type === 'shopify_product_card') {
      const run: WireComponent[] = [];
      while (i < components.length && components[i].type === 'shopify_product_card') {
        run.push(components[i++]);
      }
      const host = run.length > 1
        ? el('div', { className: 'mcx-components-carousel', 'data-carousel': 'true' })
        : container;
      let renderedInRun = 0;
      for (const card of run) {
        const mod = registry.lookup(card.type, card.version);
        if (!mod) continue;
        host.appendChild(wrapComponent(card, mod.render(card.data, ctx)));
        renderedInRun++;
      }
      if (renderedInRun > 0) {
        if (host !== container) container.appendChild(host);
        rendered += renderedInRun;
      }
      continue;
    }

    const mod = registry.lookup(comp.type, comp.version);
    if (mod) {
      container.appendChild(wrapComponent(comp, mod.render(comp.data, ctx)));
      rendered++;
    }
    i++;
  }

  return rendered > 0 ? container : null;
}

/**
 * Render suggestion pills below a message.
 * Uses .mcx-qr pill class consistent with quick-questions.ts.
 */
export function renderSuggestionPills(
  suggestions: string[],
  onSelect: (s: string) => void,
  _theme: ThemeTokens,
): HTMLDivElement | null {
  if (!suggestions.length) return null;
  const container = el('div', { className: 'mcx-suggestions' });
  for (const s of suggestions) {
    const btn = el('button', { className: 'mcx-qr mcx-suggestion-pill', type: 'button' }, [text(s)]);
    btn.addEventListener('click', () => onSelect(s));
    container.appendChild(btn);
  }
  return container;
}

/**
 * Patch a rendered component in place when a component_update WS event arrives.
 * Finds the wrapper by [data-message-id] + [data-component-id], then calls
 * module.update() if present, or re-renders the inner element otherwise.
 */
export function applyComponentUpdate(
  messagesEl: HTMLElement,
  messageId: string,
  componentId: string,
  data: unknown,
  ctx: RenderCtx,
  registry: ComponentRegistry = componentRegistry,
): void {
  // No wire-version re-check here by design: updates only target instances
  // that were version-supported at render time (unsupported versions were
  // never rendered, so the selector no-ops), and the hub does not bump
  // schema versions for live instances.
  let msgWrapper: Element | null;
  let wrapper: Element | null;
  try {
    msgWrapper = messagesEl.querySelector(`[data-message-id="${cssAttrEscape(messageId)}"]`);
    if (!msgWrapper) return;
    wrapper = msgWrapper.querySelector(`[data-component-id="${cssAttrEscape(componentId)}"]`);
  } catch {
    // Hostile id that still produces an invalid selector after escaping — no-op.
    return;
  }
  if (!wrapper) return;
  const type = wrapper.getAttribute('data-component-type');
  if (!type) return;
  const mod = registry.lookup(type);
  if (!mod) return;
  if (mod.update) {
    const inner = wrapper.firstElementChild as HTMLElement | null;
    if (inner) mod.update(inner, data);
  } else {
    wrapper.replaceChildren(mod.render(data, ctx));
  }
}
