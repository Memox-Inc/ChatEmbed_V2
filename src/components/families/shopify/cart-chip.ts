/**
 * Cart chip: header badge widget (MMX-468, Task 7).
 *
 * createCartChip() produces a pill-shaped button with a shopping-bag SVG icon
 * and a count display. The caller (index.ts) owns the chip lifecycle and calls
 * updateCartChip() whenever the cart's total_quantity changes.
 *
 * All DOM created via core/dom.ts el()/svg()/text() helpers.
 * No hex literals; colors supplied as parameters from theme tokens at call site.
 */

import { el, svg, text } from '../../core/dom';
import { findComponentWrapper } from '../../core/message-integration';

// ---- SVG icon ----------------------------------------------------------------

function bagIcon(): SVGSVGElement {
  return svg('svg', {
    width: '15', height: '15',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }, [
    svg('path', { d: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z' }),
    svg('line', { x1: '3', y1: '6', x2: '21', y2: '6' }),
    svg('path', { d: 'M16 10a4 4 0 01-8 0' }),
  ]);
}

// ---- public API --------------------------------------------------------------

/**
 * Create a cart chip button.
 *
 * @param count          Current item count (total_quantity from ShopifyCartData).
 * @param onClick        Callback invoked on click or Enter/Space keydown.
 * @param primaryColor   ctx.theme.primary
 * @param primaryLightColor ctx.theme.primaryLight
 */
export function createCartChip(
  count: number,
  onClick: () => void,
  primaryColor: string,
  primaryLightColor: string,
): HTMLDivElement {
  const chip = el('div', {
    'data-part': 'cart-chip',
    // Token colors stored at create time so updateCartChip can style a
    // newly created badge without recovering colors from style properties.
    'data-primary': primaryColor,
    'data-primary-light': primaryLightColor,
    role: 'button',
    tabindex: '0',
    'aria-label': `View cart, ${count} item${count === 1 ? '' : 's'}`,
  }) as HTMLDivElement;

  applyChipStyles(chip, primaryColor, primaryLightColor);

  const iconWrap = el('span', { 'data-part': 'chip-icon' });
  iconWrap.style.cssText = 'display:flex;align-items:center;';
  iconWrap.appendChild(bagIcon());
  chip.appendChild(iconWrap);

  const countEl = el('span', { 'data-part': 'chip-count' }, [text(String(count))]);
  applyCountStyles(countEl, primaryColor);
  chip.appendChild(countEl);

  if (count > 0) {
    const badge = el('span', { 'data-part': 'chip-badge' }, [text(String(count))]);
    applyBadgeStyles(badge, primaryColor, primaryLightColor);
    chip.appendChild(badge);
  }

  chip.addEventListener('click', onClick);
  chip.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  });

  return chip as HTMLDivElement;
}

/**
 * Update the chip's count in place without recreating the element.
 * Call this whenever total_quantity changes (e.g. after a component_update).
 */
export function updateCartChip(chip: HTMLDivElement, count: number): void {
  const countEl = chip.querySelector('[data-part="chip-count"]');
  if (countEl) countEl.textContent = String(count);

  chip.setAttribute('aria-label', `View cart, ${count} item${count === 1 ? '' : 's'}`);

  let badge = chip.querySelector('[data-part="chip-badge"]') as HTMLElement | null;
  if (count > 0) {
    if (!badge) {
      badge = el('span', { 'data-part': 'chip-badge' });
      // Token colors stamped on the chip root by createCartChip.
      applyBadgeStyles(
        badge,
        chip.getAttribute('data-primary') ?? '',
        chip.getAttribute('data-primary-light') ?? '',
      );
      chip.appendChild(badge);
    }
    badge.textContent = String(count);
  } else if (badge) {
    badge.remove();
  }
}

/**
 * Read total_quantity from an unknown cart component data payload.
 * Returns null when the field is absent or not a number.
 */
export function readCartQuantity(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const q = (data as { total_quantity?: unknown }).total_quantity;
  return typeof q === 'number' ? q : null;
}

/**
 * Sync the cart chip from a component_update WS frame. Type-gated on the
 * rendered wrapper: the frame's ids are resolved with the SAME lookup
 * applyComponentUpdate uses, and setCount fires only when that wrapper is
 * stamped data-component-type="shopify_cart". No wrapper, no sync; no
 * payload shape sniffing.
 */
export function syncCartChipOnComponentUpdate(
  messagesEl: HTMLElement,
  messageId: string,
  componentId: string,
  data: unknown,
  setCount: (totalQuantity: number) => void,
): void {
  const wrapper = findComponentWrapper(messagesEl, messageId, componentId);
  if (!wrapper || wrapper.getAttribute('data-component-type') !== 'shopify_cart') return;
  const qty = readCartQuantity(data);
  if (qty !== null) setCount(qty);
}

// ---- style helpers -----------------------------------------------------------

function applyChipStyles(chip: HTMLElement, primaryColor: string, primaryLightColor: string): void {
  chip.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:4px',
    'padding:4px 8px',
    `background:${primaryLightColor}`,
    `color:${primaryColor}`,
    'border-radius:20px',
    'cursor:pointer',
    'user-select:none',
    'position:relative',
  ].join(';');
}

function applyCountStyles(el: HTMLElement, primaryColor: string): void {
  el.style.cssText = [
    'font-size:12px',
    'font-weight:600',
    `color:${primaryColor}`,
  ].join(';');
}

function applyBadgeStyles(el: HTMLElement, primaryColor: string, onPrimaryColor: string): void {
  el.style.cssText = [
    'position:absolute',
    'top:-4px',
    'right:-4px',
    'min-width:16px',
    'height:16px',
    'border-radius:8px',
    `background:${primaryColor}`,
    `color:${onPrimaryColor}`,
    'font-size:10px',
    'font-weight:700',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0 3px',
    'line-height:1',
  ].join(';');
}
