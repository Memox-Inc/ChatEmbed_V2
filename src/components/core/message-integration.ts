import type { WireComponent, RenderCtx, ThemeTokens, ComponentsEnabled } from './types';
import { componentRegistry, type ComponentRegistry } from './registry';
import { el, text } from './dom';

/**
 * Map a wire component type to its componentsEnabled family (plan addendum).
 * shopify_* -> shopify, calendar_* -> calendar, web_call -> web_call.
 * Returns null for unknown families: those are UNGATED (forward compatible;
 * the registry lookup remains the only gate for them).
 */
export function familyOf(type: string): keyof ComponentsEnabled | null {
  if (type.startsWith('shopify_')) return 'shopify';
  if (type.startsWith('calendar_')) return 'calendar';
  if (type === 'web_call') return 'web_call';
  return null;
}

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
 * Build the per-component RenderCtx a renderer dispatches with. Stamps the
 * component's own wire id plus the owning message id so calendar.book /
 * shopify.* actions carry real ids (the hub ownership policy 403s any action
 * whose component_id does not belong to the claimed message).
 */
function perComponentCtx(ctx: RenderCtx, comp: WireComponent, messageId?: string): RenderCtx {
  return { ...ctx, componentId: comp.id, messageId: messageId ?? ctx.messageId };
}

/**
 * Render all components from a message into a wrapper div.
 * Returns null if no components are renderable.
 * Consecutive shopify_product_card runs (2+) are grouped under a carousel
 * layout container. The carousel container carries NO component id; each
 * card keeps its OWN wrapper stamped with its individual data-component-id
 * so applyComponentUpdate addresses grouped and ungrouped components
 * uniformly.
 *
 * `messageId` is the owning message's id (threaded from message-bubble.ts);
 * each renderer receives a per-component ctx carrying it plus its own
 * component id. If omitted, a `messageId` already present on ctx is kept.
 */
export function renderComponentsBlock(
  components: WireComponent[],
  ctx: RenderCtx,
  registry: ComponentRegistry = componentRegistry,
  messageId?: string,
): HTMLDivElement | null {
  if (!components.length) return null;
  // componentsEnabled gate (plan addendum): components of disabled families
  // render nothing -- silent skip, exactly like unknown types. Unknown
  // families (familyOf -> null) are ungated.
  const gated = components.filter((comp) => {
    const family = familyOf(comp.type);
    return family === null || ctx.enabled[family];
  });
  if (!gated.length) return null;
  const container = el('div', { className: 'mcx-components-block' });
  let rendered = 0;
  let i = 0;

  while (i < gated.length) {
    const comp = gated[i];

    if (comp.type === 'shopify_product_card') {
      const run: WireComponent[] = [];
      while (i < gated.length && gated[i].type === 'shopify_product_card') {
        run.push(gated[i++]);
      }
      const host = run.length > 1
        ? el('div', { className: 'mcx-components-carousel', 'data-carousel': 'true' })
        : container;
      let renderedInRun = 0;
      for (const card of run) {
        const mod = registry.lookup(card.type, card.version);
        if (!mod) continue;
        const cardCtx = perComponentCtx(ctx, card, messageId);
        const inner = mod.render(card.data, cardCtx);
        // Stamp _ctx so module.update() can re-render with the original ctx
        // (see CalendarSlotsModule.update, CalendarBookingConfirmedModule.update,
        // WebCallCardModule.update, all guard on el._ctx being set).
        (inner as HTMLElement & { _ctx?: RenderCtx })._ctx = cardCtx;
        host.appendChild(wrapComponent(card, inner));
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
      const compCtx = perComponentCtx(ctx, comp, messageId);
      const inner = mod.render(comp.data, compCtx);
      // Stamp _ctx so module.update() can re-render with the original ctx.
      (inner as HTMLElement & { _ctx?: RenderCtx })._ctx = compCtx;
      container.appendChild(wrapComponent(comp, inner));
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
 * Locate a rendered component wrapper by [data-message-id] then
 * [data-component-id]. The single lookup used by applyComponentUpdate and
 * any other component_update consumer (e.g. the cart-chip sync) so they
 * can never disagree about which element a frame targets.
 * Returns null when either id has no match or produces a hostile selector.
 */
export function findComponentWrapper(
  messagesEl: HTMLElement,
  messageId: string,
  componentId: string,
): Element | null {
  try {
    const msgWrapper = messagesEl.querySelector(`[data-message-id="${cssAttrEscape(messageId)}"]`);
    if (!msgWrapper) return null;
    return msgWrapper.querySelector(`[data-component-id="${cssAttrEscape(componentId)}"]`);
  } catch {
    // Hostile id that still produces an invalid selector after escaping.
    return null;
  }
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
  const wrapper = findComponentWrapper(messagesEl, messageId, componentId);
  if (!wrapper) return;
  const type = wrapper.getAttribute('data-component-type');
  if (!type) return;
  const mod = registry.lookup(type);
  if (!mod) return;
  if (mod.update) {
    const inner = wrapper.firstElementChild as HTMLElement | null;
    if (inner) mod.update(inner, data);
  } else {
    // Re-render path: rebuild a per-component ctx so dispatches from the
    // fresh render keep carrying the real message/component ids.
    const freshCtx = { ...ctx, messageId, componentId };
    const freshEl = mod.render(data, freshCtx);
    // Stamp _ctx on the fresh element so a future update() call can read it.
    (freshEl as HTMLElement & { _ctx?: RenderCtx })._ctx = freshCtx;
    wrapper.replaceChildren(freshEl);
  }
}

/**
 * Apply the updated components an action result envelope carries (the
 * dispatch wrapper in index.ts calls this after every ok dispatch). Each
 * component is patched in the live DOM exactly like a component_update WS
 * frame; `onComponentApplied` runs after each apply so the integrator can
 * hook cross-cutting sync (e.g. the header cart chip, which is type-gated
 * and no-ops for non-cart components).
 */
export function applyActionResultComponents(
  messagesEl: HTMLElement,
  messageId: string,
  components: WireComponent[],
  ctx: RenderCtx,
  onComponentApplied?: (comp: WireComponent) => void,
  registry: ComponentRegistry = componentRegistry,
): void {
  for (const comp of components) {
    applyComponentUpdate(messagesEl, messageId, comp.id, comp.data, ctx, registry);
    onComponentApplied?.(comp);
  }
}
