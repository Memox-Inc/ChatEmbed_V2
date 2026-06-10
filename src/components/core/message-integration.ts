import type { WireComponent, RenderCtx, ThemeTokens } from './types';
import { componentRegistry } from './registry';
import { el, text } from './dom';

/**
 * Render all components from a message into a wrapper div.
 * Returns null if no components are renderable.
 * Consecutive shopify_product_card runs are grouped for carousel rendering.
 */
export function renderComponentsBlock(
  components: WireComponent[],
  ctx: RenderCtx,
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
      const mod = componentRegistry.lookup('shopify_product_card', run[0].version)
               ?? componentRegistry.lookup('shopify_product_card_carousel');
      if (mod) {
        const wrapper = el('div', {
          className: 'mcx-component-wrapper',
          'data-component-type': 'shopify_product_card',
          'data-component-id': run.map((c) => c.id).join(','),
        });
        wrapper.appendChild(mod.render(run, ctx));
        container.appendChild(wrapper);
        rendered++;
      }
      continue;
    }

    const mod = componentRegistry.lookup(comp.type, comp.version);
    if (mod) {
      const wrapper = el('div', {
        className: 'mcx-component-wrapper',
        'data-component-type': comp.type,
        'data-component-id': comp.id,
      });
      wrapper.appendChild(mod.render(comp.data, ctx));
      container.appendChild(wrapper);
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
): void {
  const msgWrapper = messagesEl.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!msgWrapper) return;
  const wrapper = msgWrapper.querySelector(`[data-component-id="${CSS.escape(componentId)}"]`);
  if (!wrapper) return;
  const type = wrapper.getAttribute('data-component-type');
  if (!type) return;
  const mod = componentRegistry.lookup(type);
  if (!mod) return;
  if (mod.update) {
    const inner = wrapper.firstElementChild as HTMLElement | null;
    if (inner) mod.update(inner, data);
  } else {
    wrapper.replaceChildren(mod.render(data, ctx));
  }
}
