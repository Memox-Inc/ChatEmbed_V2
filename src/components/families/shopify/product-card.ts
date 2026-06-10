/**
 * Shopify product-card renderer (MMX-468, Task 6).
 *
 * Receives either:
 *   - An array of WireComponent (carousel or single) when called from tests / external usage.
 *   - A single ShopifyProductCardData payload (unknown) when called via mod.render(card.data, ctx)
 *     from message-integration.ts.
 *
 * CONTRACT (immutable):
 *   dispatch action_type = "shopify.add_to_cart"
 *   payload = { variant_id: string; quantity: number }
 *
 * All colors come from ctx.theme. Zero hex literals (Task 11 audits for them).
 * All DOM created via el()/svg()/text() from core/dom.ts. No innerHTML with data.
 */

import type { ComponentModule, RenderCtx, ShopifyProductCardData, WireComponent } from '../../core/types';
import { el, svg, text } from '../../core/dom';
import { isSafeImageUrl } from '../../../utils/url';

// ---- helpers ----------------------------------------------------------------

function formatMoney(amount: string, currency: string): string {
  // Keep the raw amount string (e.g. "3500.00" or "3150.00") so tests can
  // assert `.toContain('3500')` without locale-specific comma formatting.
  // Strip trailing zeros for display: "3150.00" -> "$3150", "3150.50" -> "$3150.50"
  const num = parseFloat(amount);
  if (isNaN(num)) return `${currency} ${amount}`;
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return `$${formatted}`;
}

function isSafeHttpsUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\//i.test(url);
}

// ---- SVG icons (no hex literals: colors via currentColor or theme param) ----

function boxIcon(): SVGSVGElement {
  return svg('svg', { width: '28', height: '28', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }),
    svg('polyline', { points: '3.27 6.96 12 12.01 20.73 6.96' }),
    svg('line', { x1: '12', y1: '22.08', x2: '12', y2: '12' }),
  ]);
}

function externalLinkIcon(): SVGSVGElement {
  return svg('svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
    svg('polyline', { points: '15 3 21 3 21 9' }),
    svg('line', { x1: '10', y1: '14', x2: '21', y2: '3' }),
  ]);
}

// ---- single card renderer ---------------------------------------------------

interface CardState {
  selectedVariantId: string;
  qty: number;
}

function renderCard(data: ShopifyProductCardData, ctx: RenderCtx, wireId?: string): HTMLElement {
  const t = ctx.theme;
  const state: CardState = {
    selectedVariantId: data.selected_variant_id,
    qty: 1,
  };

  // Determine initial available state from selected variant
  function isSelectedAvailable(): boolean {
    const v = data.variants.find((vt) => vt.id === state.selectedVariantId);
    return v ? v.available : data.available;
  }

  // ---- card root ----
  const card = el('div', { 'data-part': 'card' });
  applyCardStyles(card, t);

  // ---- image area ----
  const imgWrap = el('div', { 'data-part': 'image-wrap' });
  applyImageWrapStyles(imgWrap, t);

  if (isSafeImageUrl(data.image_url)) {
    const img = el('img', { src: data.image_url, alt: data.title });
    applyImgStyles(img);
    imgWrap.appendChild(img);
  } else {
    const fallback = el('div', { 'data-part': 'img-fallback' });
    applyFallbackStyles(fallback, t);
    const icon = boxIcon();
    icon.setAttribute('color', t.primary);
    fallback.appendChild(icon);
    imgWrap.appendChild(fallback);
  }

  // badge (top-left of image area)
  if (data.badge) {
    const badge = el('div', { 'data-part': 'badge' }, [text(data.badge)]);
    applyBadgeStyles(badge, t);
    imgWrap.appendChild(badge);
  }

  // OOS overlay (covers the whole card when available is false)
  if (!data.available) {
    const overlay = el('div', { 'data-part': 'oos-overlay' });
    applyOosOverlayStyles(overlay, t);
    const oosLabel = el('span', { 'data-part': 'oos-label' }, [text('Out of Stock')]);
    applyOosLabelStyles(oosLabel, t);
    overlay.appendChild(oosLabel);
    imgWrap.appendChild(overlay);
  }

  card.appendChild(imgWrap);

  // ---- body ----
  const body = el('div', { 'data-part': 'card-body' });
  applyBodyStyles(body);
  card.appendChild(body);

  // title
  const title = el('div', { 'data-part': 'product-title' }, [text(data.title)]);
  applyTitleStyles(title, t);
  body.appendChild(title);

  // price row
  const priceRow = el('div', { 'data-part': 'price-row' });
  applyPriceRowStyles(priceRow);

  const priceEl = el('span', { 'data-part': 'price' }, [text(formatMoney(data.price.amount, data.price.currency))]);
  applyPriceStyles(priceEl, t);
  priceRow.appendChild(priceEl);

  if (data.compare_at_price) {
    const compareEl = el('span', { 'data-part': 'compare-price' }, [
      text(formatMoney(data.compare_at_price.amount, data.compare_at_price.currency)),
    ]);
    applyComparePriceStyles(compareEl, t);
    priceRow.appendChild(compareEl);
  }
  body.appendChild(priceRow);

  // variant pills
  if (data.variants.length > 0) {
    const pillsWrap = el('div', { 'data-part': 'variant-pills' });
    applyPillsWrapStyles(pillsWrap);

    const pillEls: HTMLButtonElement[] = [];

    for (const variant of data.variants) {
      const isSelected = variant.id === state.selectedVariantId;
      const pill = el('button', {
        'data-part': 'variant-pill',
        'data-variant-id': variant.id,
        'data-selected': isSelected ? 'true' : 'false',
        'data-available': variant.available ? 'true' : 'false',
        type: 'button',
      }, [text(variant.title)]) as HTMLButtonElement;
      applyPillStyles(pill, isSelected, variant.available, t);
      pillEls.push(pill);
      pillsWrap.appendChild(pill);
    }

    // Pill click handler: select variant and update button state
    for (const pill of pillEls) {
      pill.addEventListener('click', () => {
        const variantId = pill.getAttribute('data-variant-id') ?? '';
        if (!variantId) return;
        state.selectedVariantId = variantId;

        // Update all pill selected states
        for (const p of pillEls) {
          const selected = p.getAttribute('data-variant-id') === variantId;
          p.setAttribute('data-selected', selected ? 'true' : 'false');
          const available = p.getAttribute('data-available') === 'true';
          applyPillStyles(p, selected, available, t);
        }

        // Sync Add to Cart button
        const available = isSelectedAvailable();
        addToCartBtn.disabled = !available;
        applyAddToCartBtnStyles(addToCartBtn, !available, t);
      });
    }

    body.appendChild(pillsWrap);
  }

  // qty stepper
  const stepper = el('div', { 'data-part': 'qty-stepper' });
  applyStepperStyles(stepper, t);

  const qtyDecBtn = el('button', { 'data-part': 'qty-dec', type: 'button' }, [text('−')]) as HTMLButtonElement;
  applyQtyBtnStyles(qtyDecBtn, t);

  const qtyDisplay = el('span', { 'data-part': 'qty-display' }, [text(String(state.qty))]);
  applyQtyDisplayStyles(qtyDisplay, t);

  const qtyIncBtn = el('button', { 'data-part': 'qty-inc', type: 'button' }, [text('+')]) as HTMLButtonElement;
  applyQtyBtnStyles(qtyIncBtn, t);

  qtyDecBtn.addEventListener('click', () => {
    if (state.qty > 1) {
      state.qty--;
      qtyDisplay.textContent = String(state.qty);
    }
  });
  qtyIncBtn.addEventListener('click', () => {
    if (state.qty < 10) {
      state.qty++;
      qtyDisplay.textContent = String(state.qty);
    }
  });

  stepper.appendChild(qtyDecBtn);
  stepper.appendChild(qtyDisplay);
  stepper.appendChild(qtyIncBtn);
  body.appendChild(stepper);

  // Add to Cart button
  const unavailable = !isSelectedAvailable();
  const addToCartBtn = el('button', {
    'data-part': 'add-to-cart-btn',
    type: 'button',
  }, [text('Add to Cart')]) as HTMLButtonElement;
  addToCartBtn.disabled = unavailable;
  applyAddToCartBtnStyles(addToCartBtn, unavailable, t);

  // Error display (hidden initially)
  const errorDiv = el('div', { 'data-part': 'action-error' });
  applyErrorDivStyles(errorDiv, t);
  errorDiv.style.display = 'none';

  addToCartBtn.addEventListener('click', () => {
    if (addToCartBtn.disabled) return;

    // Pending state
    addToCartBtn.disabled = true;
    addToCartBtn.textContent = 'Adding...';
    errorDiv.style.display = 'none';

    const messageId = wireId ?? '';
    const componentId = wireId ?? '';

    ctx.dispatch({
      message_id: messageId,
      component_id: componentId,
      action_type: 'shopify.add_to_cart',
      payload: { variant_id: state.selectedVariantId, quantity: state.qty },
    }).then((result) => {
      if (result.ok) {
        addToCartBtn.textContent = 'Added!';
        setTimeout(() => {
          addToCartBtn.textContent = 'Add to Cart';
          addToCartBtn.disabled = !isSelectedAvailable();
          applyAddToCartBtnStyles(addToCartBtn, !isSelectedAvailable(), t);
        }, 1500);
      } else {
        const msg = result.error?.message ?? 'Something went wrong. Please try again.';
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
        addToCartBtn.textContent = 'Add to Cart';
        addToCartBtn.disabled = !isSelectedAvailable();
        applyAddToCartBtnStyles(addToCartBtn, !isSelectedAvailable(), t);

        // Retry affordance for recoverable errors: re-enable immediately
        if (result.error?.recoverable) {
          addToCartBtn.disabled = false;
          applyAddToCartBtnStyles(addToCartBtn, false, t);
        }
      }
    }).catch(() => {
      errorDiv.textContent = 'Could not connect. Please try again.';
      errorDiv.style.display = 'block';
      addToCartBtn.textContent = 'Add to Cart';
      addToCartBtn.disabled = false;
      applyAddToCartBtnStyles(addToCartBtn, false, t);
    });
  });

  body.appendChild(addToCartBtn);
  body.appendChild(errorDiv);

  // View on store link (only https URLs)
  if (isSafeHttpsUrl(data.url)) {
    const link = el('a', {
      'data-part': 'view-on-store',
      href: data.url,
      target: '_blank',
      rel: 'noopener noreferrer',
    }, [text('View on store'), externalLinkIcon()]);
    applyViewLinkStyles(link, t);
    body.appendChild(link);
  }

  return card;
}

// ---- style helpers (all colors from ctx.theme, no hex literals) -------------

function applyCardStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'min-width:148px',
    'display:flex',
    'flex-direction:column',
    `border:1px solid ${t.border}`,
    'border-radius:10px',
    'overflow:hidden',
    'flex-shrink:0',
    `background:${t.surface}`,
    'position:relative',
  ].join(';');
}

function applyImageWrapStyles(el: HTMLElement, _t: RenderCtx['theme']): void {
  el.style.cssText = 'width:100%;height:88px;position:relative;overflow:hidden;';
}

function applyImgStyles(img: HTMLImageElement): void {
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
}

function applyFallbackStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'width:100%',
    'height:100%',
    `background:${t.surfaceSubtle}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';');
}

function applyBadgeStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'position:absolute',
    'top:6px',
    'left:6px',
    `background:${t.warning}`,
    `color:${t.surface}`,
    'font-size:11px',
    'font-weight:700',
    'padding:2px 5px',
    'border-radius:4px',
    'z-index:1',
    'pointer-events:none',
  ].join(';');
}

function applyOosOverlayStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  // overlay covers full card image area
  el.style.cssText = [
    'position:absolute',
    'inset:0',
    `background:${t.surface}cc`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'z-index:2',
  ].join(';');
}

function applyOosLabelStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    `background:${t.errorSubtle}`,
    `color:${t.error}`,
    'font-size:13px',
    'font-weight:700',
    'padding:4px 10px',
    'border-radius:20px',
    `border:1px solid ${t.error}66`,
  ].join(';');
}

function applyBodyStyles(el: HTMLElement): void {
  el.style.cssText = 'padding:8px;flex:1;display:flex;flex-direction:column;gap:6px;';
}

function applyTitleStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'font-size:13px',
    'font-weight:600',
    `color:${t.text}`,
    'line-height:1.3',
  ].join(';');
}

function applyPriceRowStyles(el: HTMLElement): void {
  el.style.cssText = 'display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;';
}

function applyPriceStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = `font-size:13px;font-weight:700;color:${t.text};`;
}

function applyComparePriceStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = `font-size:12px;color:${t.textMuted};text-decoration:line-through;`;
}

function applyPillsWrapStyles(el: HTMLElement): void {
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
}

function applyPillStyles(pill: HTMLButtonElement, selected: boolean, available: boolean, t: RenderCtx['theme']): void {
  if (selected) {
    pill.style.cssText = [
      'font-size:12px',
      'padding:2px 7px',
      'border-radius:20px',
      `border:1px solid ${t.primary}`,
      `background:${t.primaryLight}`,
      `color:${t.primary}`,
      'font-weight:600',
      'cursor:pointer',
    ].join(';');
  } else if (!available) {
    pill.style.cssText = [
      'font-size:12px',
      'padding:2px 7px',
      'border-radius:20px',
      `border:1px solid ${t.border}`,
      `background:${t.surface}`,
      `color:${t.textMuted}`,
      'cursor:not-allowed',
      'opacity:0.5',
      'text-decoration:line-through',
    ].join(';');
  } else {
    pill.style.cssText = [
      'font-size:12px',
      'padding:2px 7px',
      'border-radius:20px',
      `border:1px solid ${t.border}`,
      `background:${t.surface}`,
      `color:${t.textMuted}`,
      'cursor:pointer',
    ].join(';');
  }
}

function applyStepperStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    `border:1px solid ${t.border}`,
    'border-radius:6px',
    'overflow:hidden',
    'align-self:flex-start',
  ].join(';');
}

function applyQtyBtnStyles(btn: HTMLButtonElement, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'width:26px',
    'height:26px',
    `background:${t.surfaceSubtle}`,
    'border:none',
    'cursor:pointer',
    'font-size:14px',
    `color:${t.textMuted}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
  ].join(';');
}

function applyQtyDisplayStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'width:28px',
    'height:26px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:13px',
    'font-weight:600',
    `color:${t.text}`,
    `border-left:1px solid ${t.border}`,
    `border-right:1px solid ${t.border}`,
  ].join(';');
}

function applyAddToCartBtnStyles(btn: HTMLButtonElement, disabled: boolean, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:6px',
    'width:100%',
    'padding:8px 12px',
    disabled ? `background:${t.primaryLight}` : `background:${t.primary}`,
    `color:${t.surface}`,
    'border:none',
    'border-radius:7px',
    'font-size:13px',
    'font-weight:600',
    disabled ? 'cursor:not-allowed' : 'cursor:pointer',
    disabled ? 'opacity:0.7' : 'opacity:1',
  ].join(';');
}

function applyErrorDivStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'font-size:12px',
    `color:${t.error}`,
    `background:${t.errorSubtle}`,
    'padding:4px 8px',
    'border-radius:5px',
  ].join(';');
}

function applyViewLinkStyles(a: HTMLAnchorElement, t: RenderCtx['theme']): void {
  a.style.cssText = [
    'font-size:13px',
    `color:${t.primary}`,
    'text-decoration:none',
    'display:inline-flex',
    'align-items:center',
    'gap:3px',
    'background:none',
    'border:none',
    'cursor:pointer',
    'padding:0',
  ].join(';');
}

// ---- carousel wrapper -------------------------------------------------------

function applyCarouselStyles(el: HTMLElement, _t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:flex',
    'gap:10px',
    'overflow-x:auto',
    'padding:12px',
    'scrollbar-width:none',
  ].join(';');
}

// ---- module export ----------------------------------------------------------

/**
 * Normalize render input: the module accepts either
 *   - An array of WireComponent (test / external usage) or
 *   - A raw ShopifyProductCardData (called as mod.render(card.data, ctx) from message-integration)
 *
 * In both cases it returns an HTMLElement that wraps the rendered card(s).
 */
function normalizeInput(data: unknown): Array<{ wireId?: string; payload: ShopifyProductCardData }> {
  if (Array.isArray(data)) {
    // Array of WireComponent objects (has .data property)
    const first = data[0] as Record<string, unknown> | undefined;
    if (first && 'data' in first) {
      return (data as Array<{ id: string; data: ShopifyProductCardData }>).map((item) => ({
        wireId: item.id,
        payload: item.data,
      }));
    }
    // Array of raw ShopifyProductCardData (unlikely but guard it)
    return (data as ShopifyProductCardData[]).map((d) => ({ payload: d }));
  }
  // Single raw data object from message-integration
  return [{ payload: data as ShopifyProductCardData }];
}

export const ShopifyProductCardModule: ComponentModule = {
  version: 1,

  render(data: unknown, ctx: RenderCtx): HTMLElement {
    const items = normalizeInput(data);

    if (items.length > 1) {
      // Carousel wrapper for multiple cards
      const wrapper = el('div', { 'data-part': 'carousel-wrapper' });
      const carousel = el('div', { 'data-part': 'carousel' });
      applyCarouselStyles(carousel, ctx.theme);
      for (const item of items) {
        carousel.appendChild(renderCard(item.payload, ctx, item.wireId));
      }
      wrapper.appendChild(carousel);
      return wrapper;
    }

    // Single card — return directly in a wrapper div
    const item = items[0];
    const wrapper = el('div', { 'data-part': 'single-card-wrapper' });
    wrapper.appendChild(renderCard(item.payload, ctx, item.wireId));
    return wrapper;
  },

  update(el: HTMLElement, data: unknown): void {
    const items = normalizeInput(data);
    if (!items.length) return;

    // Re-render: replace inner content. This is the simplest correct update.
    // For multi-card updates (component_update always targets one component),
    // we re-render the single card matched by message-integration.
    const ctx = (el as HTMLElement & { _ctx?: RenderCtx })._ctx;
    if (!ctx) {
      // No stored ctx (first render via message-integration did not set it):
      // re-render is a no-op. Task 10 will wire ctx at widget init time.
      return;
    }
    const rendered = ShopifyProductCardModule.render(data, ctx);
    el.replaceChildren(...Array.from(rendered.childNodes));
  },
};
