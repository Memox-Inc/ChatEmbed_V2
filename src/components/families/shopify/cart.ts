/**
 * Shopify cart renderer (MMX-468, Task 7).
 *
 * render(data, ctx) takes ONE raw ShopifyCartData payload, exactly as
 * message-integration.ts calls it (mod.render(cart.data, ctx)).
 *
 * CONTRACT (immutable):
 *   dispatch action_type = "shopify.update_line"  payload = { line_id, quantity }
 *   dispatch action_type = "shopify.remove_line"  payload = { line_id }
 *   dispatch action_type = "shopify.apply_discount" payload = { code }
 *   dispatch action_type = "shopify.checkout"      payload = {}
 *     -> on success open result.checkout_url in new tab (noopener)
 *     -> fire PostHog shopify_checkout_started with distinct_id + cart_id
 *
 * All colors come from ctx.theme. Zero hex literals.
 * All DOM created via el()/svg()/text() from core/dom.ts. No innerHTML with data.
 */

import type { ComponentModule, RenderCtx, ShopifyCartData, CartLine } from '../../core/types';
import { el, svg, text } from '../../core/dom';
import { isSafeImageUrl, isSafeHttpsUrl } from '../../../utils/url';
import { formatMoney, withAlpha } from '../../../utils/format';
import { capture } from '../../../analytics/posthog';

// ---- SVG icons ---------------------------------------------------------------

function shoppingBagIcon(): SVGSVGElement {
  return svg('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z' }),
    svg('line', { x1: '3', y1: '6', x2: '21', y2: '6' }),
    svg('path', { d: 'M16 10a4 4 0 01-8 0' }),
  ]);
}

function trashIcon(): SVGSVGElement {
  return svg('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('polyline', { points: '3 6 5 6 21 6' }),
    svg('path', { d: 'M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6' }),
    svg('path', { d: 'M10 11v6' }),
    svg('path', { d: 'M14 11v6' }),
    svg('path', { d: 'M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2' }),
  ]);
}

function tagIcon(): SVGSVGElement {
  return svg('svg', { width: '13', height: '13', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z' }),
    svg('line', { x1: '7', y1: '7', x2: '7.01', y2: '7' }),
  ]);
}

// ---- cart renderer -----------------------------------------------------------

function renderCart(data: ShopifyCartData, ctx: RenderCtx): HTMLElement {
  const t = ctx.theme;

  // ---- root ----
  const root = el('div', { 'data-part': 'cart' });
  applyRootStyles(root, t);

  // ---- header bar ----
  const header = el('div', { 'data-part': 'cart-header' });
  applyHeaderStyles(header, t);

  const iconWrap = el('span');
  iconWrap.style.cssText = `color:${t.primary};display:flex;align-items:center;`;
  iconWrap.appendChild(shoppingBagIcon());

  const titleEl = el('span', { 'data-part': 'cart-title' }, [text('Your Cart')]);
  applyCartTitleStyles(titleEl, t);

  const countBadge = el('span', { 'data-part': 'cart-count-badge' }, [text(`${data.total_quantity}`)]);
  applyCountBadgeStyles(countBadge, t);

  header.appendChild(iconWrap);
  header.appendChild(titleEl);
  header.appendChild(countBadge);
  root.appendChild(header);

  // ---- empty state ----
  if (data.lines.length === 0) {
    const empty = el('div', { 'data-part': 'cart-empty' }, [text('Your cart is empty.')]);
    applyEmptyStyles(empty, t);
    root.appendChild(empty);
    return root;
  }

  // ---- error display (shared, hidden initially) ----
  const errorDiv = el('div', { 'data-part': 'action-error' });
  applyErrorDivStyles(errorDiv, t);
  errorDiv.style.display = 'none';

  // ---- line items ----
  const linesList = el('div', { 'data-part': 'cart-lines' });
  applyLinesListStyles(linesList, t);

  for (const line of data.lines) {
    linesList.appendChild(renderLine(line, ctx, errorDiv));
  }
  root.appendChild(linesList);

  // ---- divider ----
  const divider = el('div', { 'data-part': 'cart-divider' });
  divider.style.cssText = `height:1px;background:${t.border};margin:0 12px;`;
  root.appendChild(divider);

  // ---- discount section ----
  const discountSection = el('div', { 'data-part': 'cart-discount' });
  applyDiscountSectionStyles(discountSection, t);

  // Show any applied discount codes
  if (data.discount_codes.length > 0) {
    const appliedWrap = el('div', { 'data-part': 'applied-discounts' });
    appliedWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;';
    for (const dc of data.discount_codes) {
      const pill = el('span', { 'data-part': 'discount-pill' });
      applyDiscountPillStyles(pill, dc.applicable, t);
      const icon = tagIcon();
      icon.style.marginRight = '3px';
      pill.appendChild(icon);
      pill.appendChild(text(dc.code));
      if (!dc.applicable) {
        const notApplied = el('span', {}, [text(' (not applied)')]);
        notApplied.style.cssText = `color:${t.error};font-size:10px;`;
        pill.appendChild(notApplied);
      }
      appliedWrap.appendChild(pill);
    }
    discountSection.appendChild(appliedWrap);
  }

  // Discount input row
  const discountRow = el('div', { 'data-part': 'discount-row' });
  discountRow.style.cssText = 'display:flex;gap:6px;align-items:center;';

  const discountInput = el('input', {
    'data-part': 'discount-input',
    type: 'text',
    placeholder: 'Discount code',
  }) as HTMLInputElement;
  applyDiscountInputStyles(discountInput, t);

  const applyBtn = el('button', {
    'data-part': 'apply-discount-btn',
    type: 'button',
  }, [text('Apply')]) as HTMLButtonElement;
  applyDiscountBtnStyles(applyBtn, false, t);

  applyBtn.addEventListener('click', () => {
    const code = discountInput.value.trim();

    applyBtn.disabled = true;
    applyBtn.textContent = 'Applying...';
    errorDiv.style.display = 'none';

    ctx.dispatch({
      message_id: '',
      component_id: '',
      action_type: 'shopify.apply_discount',
      payload: { code },
    }).then((result) => {
      if (result.ok) {
        discountInput.value = '';
        applyBtn.textContent = 'Applied!';
        setTimeout(() => {
          applyBtn.textContent = 'Apply';
          applyBtn.disabled = false;
          applyDiscountBtnStyles(applyBtn, false, t);
        }, 1500);
      } else {
        const msg = result.error?.message ?? 'Could not apply discount.';
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
        applyBtn.textContent = 'Apply';
        applyBtn.disabled = false;
        applyDiscountBtnStyles(applyBtn, false, t);
        if (result.error?.recoverable) {
          applyBtn.disabled = false;
        }
      }
    }).catch(() => {
      errorDiv.textContent = 'Could not connect. Please try again.';
      errorDiv.style.display = 'block';
      applyBtn.textContent = 'Apply';
      applyBtn.disabled = false;
      applyDiscountBtnStyles(applyBtn, false, t);
    });
  });

  discountRow.appendChild(discountInput);
  discountRow.appendChild(applyBtn);
  discountSection.appendChild(discountRow);
  root.appendChild(discountSection);

  // ---- error div (placed after discount section) ----
  root.appendChild(errorDiv);

  // ---- divider before totals ----
  const divider2 = el('div', { 'data-part': 'cart-divider-2' });
  divider2.style.cssText = `height:1px;background:${t.border};margin:0 12px;`;
  root.appendChild(divider2);

  // ---- subtotal row ----
  const subtotalRow = el('div', { 'data-part': 'subtotal-row' });
  applySubtotalRowStyles(subtotalRow, t);

  const subtotalLabel = el('span', {}, [text('Subtotal')]);
  subtotalLabel.style.cssText = `font-size:13px;color:${t.textMuted};`;

  const subtotalAmount = el('span', { 'data-part': 'subtotal' }, [
    text(formatMoney(data.subtotal.amount, data.subtotal.currency)),
  ]);
  applySubtotalAmountStyles(subtotalAmount, t);

  subtotalRow.appendChild(subtotalLabel);
  subtotalRow.appendChild(subtotalAmount);
  root.appendChild(subtotalRow);

  // ---- checkout button ----
  const checkoutBtn = el('button', {
    'data-part': 'checkout-btn',
    type: 'button',
  }, [text('Checkout')]) as HTMLButtonElement;
  applyCheckoutBtnStyles(checkoutBtn, false, t);

  checkoutBtn.addEventListener('click', () => {
    if (checkoutBtn.disabled) return;

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Opening...';

    ctx.dispatch({
      message_id: '',
      component_id: '',
      action_type: 'shopify.checkout',
      payload: {},
    }).then((result) => {
      // Prefer the URL returned by the action; fall back to the one in the
      // original data payload (server may send back an updated token).
      const url = (result.checkout_url ?? data.checkout_url) as string | null | undefined;

      if (result.ok && url && isSafeHttpsUrl(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
        // Fire PostHog conversion event
        capture('shopify_checkout_started', {
          distinct_id: ctx.distinctId,
          cart_id: data.cart_id,
        });
        checkoutBtn.textContent = 'Checkout';
        checkoutBtn.disabled = false;
        applyCheckoutBtnStyles(checkoutBtn, false, t);
      } else if (!result.ok) {
        const msg = result.error?.message ?? 'Could not open checkout.';
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
        checkoutBtn.textContent = 'Checkout';
        checkoutBtn.disabled = result.error?.recoverable === false;
        applyCheckoutBtnStyles(checkoutBtn, checkoutBtn.disabled, t);
      } else {
        // ok=true but URL failed safety check
        errorDiv.textContent = 'Checkout URL is not available.';
        errorDiv.style.display = 'block';
        checkoutBtn.textContent = 'Checkout';
        checkoutBtn.disabled = false;
        applyCheckoutBtnStyles(checkoutBtn, false, t);
      }
    }).catch(() => {
      errorDiv.textContent = 'Could not connect. Please try again.';
      errorDiv.style.display = 'block';
      checkoutBtn.textContent = 'Checkout';
      checkoutBtn.disabled = false;
      applyCheckoutBtnStyles(checkoutBtn, false, t);
    });
  });

  const checkoutWrap = el('div', { 'data-part': 'checkout-wrap' });
  checkoutWrap.style.cssText = 'padding:10px 12px 12px;';
  checkoutWrap.appendChild(checkoutBtn);
  root.appendChild(checkoutWrap);

  return root;
}

// ---- line item renderer -----------------------------------------------------

function renderLine(line: CartLine, ctx: RenderCtx, errorDiv: HTMLElement): HTMLElement {
  const t = ctx.theme;

  const lineEl = el('div', { 'data-part': 'cart-line', 'data-line-id': line.line_id });
  applyLineStyles(lineEl, t);

  // Thumbnail
  if (isSafeImageUrl(line.image_url)) {
    const img = el('img', {
      src: line.image_url,
      alt: line.title,
    }) as HTMLImageElement;
    applyLineImgStyles(img);
    lineEl.appendChild(img);
  } else {
    const imgPlaceholder = el('div', { 'data-part': 'line-img-placeholder' });
    applyLineImgPlaceholderStyles(imgPlaceholder, t);
    lineEl.appendChild(imgPlaceholder);
  }

  // Info column
  const info = el('div', { 'data-part': 'line-info' });
  info.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;';

  const titleEl = el('div', { 'data-part': 'line-title' }, [text(line.title)]);
  applyLineTitleStyles(titleEl, t);
  info.appendChild(titleEl);

  if (line.variant_title && line.variant_title !== 'Default Title') {
    const variantEl = el('div', { 'data-part': 'line-variant' }, [text(line.variant_title)]);
    variantEl.style.cssText = `font-size:11px;color:${t.textMuted};`;
    info.appendChild(variantEl);
  }

  const lineTotalEl = el('div', { 'data-part': 'line-total' }, [
    text(formatMoney(line.line_total.amount, line.line_total.currency)),
  ]);
  lineTotalEl.style.cssText = `font-size:12px;font-weight:600;color:${t.text};margin-top:2px;`;
  info.appendChild(lineTotalEl);

  lineEl.appendChild(info);

  // Controls column: qty stepper + remove button
  const controls = el('div', { 'data-part': 'line-controls' });
  controls.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;';

  // Qty stepper
  const stepper = el('div', { 'data-part': 'line-qty-stepper' });
  applyLineStepperStyles(stepper, t);

  const decBtn = el('button', {
    'data-part': 'line-qty-dec',
    type: 'button',
    'aria-label': 'Decrease quantity',
  }, [text('−')]) as HTMLButtonElement;
  applyLineQtyBtnStyles(decBtn, t);

  const qtyDisplay = el('span', { 'data-part': 'line-qty-display' }, [text(String(line.quantity))]);
  applyLineQtyDisplayStyles(qtyDisplay, t);

  const incBtn = el('button', {
    'data-part': 'line-qty-inc',
    type: 'button',
    'aria-label': 'Increase quantity',
  }, [text('+')]) as HTMLButtonElement;
  applyLineQtyBtnStyles(incBtn, t);

  // Local mutable quantity for optimistic updates
  let currentQty = line.quantity;

  function dispatchUpdateLine(newQty: number): void {
    decBtn.disabled = true;
    incBtn.disabled = true;
    ctx.dispatch({
      message_id: '',
      component_id: '',
      action_type: 'shopify.update_line',
      payload: { line_id: line.line_id, quantity: newQty },
    }).then((result) => {
      if (result.ok) {
        currentQty = newQty;
        qtyDisplay.textContent = String(currentQty);
        errorDiv.style.display = 'none';
      } else {
        const msg = result.error?.message ?? 'Could not update quantity.';
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
        qtyDisplay.textContent = String(currentQty);
      }
      decBtn.disabled = currentQty <= 1;
      incBtn.disabled = false;
    }).catch(() => {
      errorDiv.textContent = 'Could not connect. Please try again.';
      errorDiv.style.display = 'block';
      decBtn.disabled = false;
      incBtn.disabled = false;
    });
  }

  decBtn.disabled = currentQty <= 1;

  decBtn.addEventListener('click', () => {
    if (decBtn.disabled || currentQty <= 1) return;
    dispatchUpdateLine(currentQty - 1);
  });

  incBtn.addEventListener('click', () => {
    if (incBtn.disabled) return;
    dispatchUpdateLine(currentQty + 1);
  });

  stepper.appendChild(decBtn);
  stepper.appendChild(qtyDisplay);
  stepper.appendChild(incBtn);
  controls.appendChild(stepper);

  // Remove button
  const removeBtn = el('button', {
    'data-part': 'remove-line-btn',
    type: 'button',
    'aria-label': `Remove ${line.title}`,
  }) as HTMLButtonElement;
  applyRemoveBtnStyles(removeBtn, t);
  const removeIcon = trashIcon();
  removeIcon.setAttribute('aria-hidden', 'true');
  removeBtn.appendChild(removeIcon);

  removeBtn.addEventListener('click', () => {
    removeBtn.disabled = true;
    errorDiv.style.display = 'none';

    ctx.dispatch({
      message_id: '',
      component_id: '',
      action_type: 'shopify.remove_line',
      payload: { line_id: line.line_id },
    }).then((result) => {
      if (result.ok) {
        // The server will push a component_update; for now just visually
        // fade the line out to give immediate feedback.
        lineEl.style.opacity = '0.4';
        lineEl.style.pointerEvents = 'none';
        errorDiv.style.display = 'none';
      } else {
        const msg = result.error?.message ?? 'Could not remove item.';
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
        removeBtn.disabled = false;
      }
    }).catch(() => {
      errorDiv.textContent = 'Could not connect. Please try again.';
      errorDiv.style.display = 'block';
      removeBtn.disabled = false;
    });
  });

  controls.appendChild(removeBtn);
  lineEl.appendChild(controls);

  return lineEl;
}

// ---- style helpers -----------------------------------------------------------

function applyRootStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    `background:${t.surface}`,
    `border:1px solid ${t.border}`,
    'border-radius:10px',
    'overflow:hidden',
    'display:flex',
    'flex-direction:column',
    'min-width:260px',
    'max-width:360px',
  ].join(';');
}

function applyHeaderStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:6px',
    'padding:10px 12px',
    `background:${t.surfaceSubtle}`,
    `border-bottom:1px solid ${t.border}`,
  ].join(';');
}

function applyCartTitleStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'font-size:14px',
    'font-weight:600',
    `color:${t.text}`,
    'flex:1',
  ].join(';');
}

function applyCountBadgeStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'font-size:11px',
    'font-weight:700',
    `background:${t.primary}`,
    `color:${t.surface}`,
    'border-radius:10px',
    'padding:1px 6px',
    'min-width:18px',
    'text-align:center',
  ].join(';');
}

function applyEmptyStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'padding:24px 12px',
    'text-align:center',
    `color:${t.textMuted}`,
    'font-size:13px',
  ].join(';');
}

function applyLinesListStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:flex',
    'flex-direction:column',
    `gap:0`,
  ].join(';');
  void t; // used in child renders
}

function applyLineStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:flex',
    'align-items:flex-start',
    'gap:8px',
    'padding:10px 12px',
    `border-bottom:1px solid ${withAlpha(t.border, '80')}`,
  ].join(';');
}

function applyLineImgStyles(img: HTMLImageElement): void {
  img.style.cssText = [
    'width:48px',
    'height:48px',
    'object-fit:cover',
    'border-radius:6px',
    'flex-shrink:0',
  ].join(';');
}

function applyLineImgPlaceholderStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'width:48px',
    'height:48px',
    `background:${t.surfaceSubtle}`,
    'border-radius:6px',
    'flex-shrink:0',
  ].join(';');
}

function applyLineTitleStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'font-size:13px',
    'font-weight:500',
    `color:${t.text}`,
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';');
}

function applyLineStepperStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    `border:1px solid ${t.border}`,
    'border-radius:5px',
    'overflow:hidden',
  ].join(';');
}

function applyLineQtyBtnStyles(btn: HTMLButtonElement, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'width:22px',
    'height:22px',
    `background:${t.surfaceSubtle}`,
    'border:none',
    'cursor:pointer',
    'font-size:13px',
    `color:${t.textMuted}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
  ].join(';');
}

function applyLineQtyDisplayStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'width:24px',
    'height:22px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:12px',
    'font-weight:600',
    `color:${t.text}`,
    `border-left:1px solid ${t.border}`,
    `border-right:1px solid ${t.border}`,
  ].join(';');
}

function applyRemoveBtnStyles(btn: HTMLButtonElement, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'background:none',
    'border:none',
    'cursor:pointer',
    'padding:2px',
    `color:${t.textMuted}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'border-radius:4px',
  ].join(';');
}

function applyDiscountSectionStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'padding:8px 12px',
    `border-bottom:1px solid ${t.border}`,
  ].join(';');
}

function applyDiscountPillStyles(el: HTMLElement, applicable: boolean, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'font-size:11px',
    'font-weight:600',
    'padding:2px 7px',
    'border-radius:20px',
    applicable ? `background:${t.successSubtle}` : `background:${t.errorSubtle}`,
    applicable ? `color:${t.success}` : `color:${t.error}`,
    applicable ? `border:1px solid ${withAlpha(t.success, '66')}` : `border:1px solid ${withAlpha(t.error, '66')}`,
  ].join(';');
}

function applyDiscountInputStyles(input: HTMLInputElement, t: RenderCtx['theme']): void {
  input.style.cssText = [
    'flex:1',
    'font-size:12px',
    'padding:5px 8px',
    `border:1px solid ${t.border}`,
    'border-radius:5px',
    'outline:none',
    `color:${t.text}`,
    `background:${t.surface}`,
    'min-width:0',
  ].join(';');
}

function applyDiscountBtnStyles(btn: HTMLButtonElement, _disabled: boolean, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'font-size:12px',
    'font-weight:600',
    'padding:5px 10px',
    `background:${t.primaryLight}`,
    `color:${t.primary}`,
    'border:none',
    'border-radius:5px',
    'cursor:pointer',
    'white-space:nowrap',
    'flex-shrink:0',
  ].join(';');
}

function applySubtotalRowStyles(el: HTMLElement, _t: RenderCtx['theme']): void {
  el.style.cssText = [
    'display:flex',
    'justify-content:space-between',
    'align-items:center',
    'padding:8px 12px',
  ].join(';');
}

function applySubtotalAmountStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = [
    'font-size:14px',
    'font-weight:700',
    `color:${t.text}`,
  ].join(';');
}

function applyCheckoutBtnStyles(btn: HTMLButtonElement, disabled: boolean, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:100%',
    'padding:9px 12px',
    disabled ? `background:${t.primaryLight}` : `background:${t.primary}`,
    `color:${t.surface}`,
    'border:none',
    'border-radius:7px',
    'font-size:14px',
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
    'margin:0 12px',
    'border-radius:5px',
  ].join(';');
}

// ---- module export ----------------------------------------------------------

export const ShopifyCartModule: ComponentModule = {
  version: 1,

  /**
   * data is ONE raw ShopifyCartData payload (the WireComponent.data field).
   */
  render(data: unknown, ctx: RenderCtx): HTMLElement {
    return renderCart(data as ShopifyCartData, ctx);
  },

  /**
   * Re-render the full cart and swap it in place. Guards on missing _ctx.
   */
  update(el: HTMLElement, data: unknown): void {
    const ctx = (el as HTMLElement & { _ctx?: RenderCtx })._ctx;
    if (!ctx) return;
    const rendered = renderCart(data as ShopifyCartData, ctx);
    (rendered as HTMLElement & { _ctx?: RenderCtx })._ctx = ctx;
    el.replaceWith(rendered);
  },
};
