import { describe, it, expect, vi } from 'vitest';
import { ShopifyCartModule } from './cart';
import type { ShopifyCartData, RenderCtx, ThemeTokens } from '../../core/types';

const theme: ThemeTokens = {
  primary: '#8349ff', primaryLight: '#f0ebff', text: '#072032',
  textMuted: '#5b6b7a', border: '#e5e7eb', surface: '#fff',
  surfaceSubtle: '#f9fafb', error: '#ef4444', errorSubtle: '#fee2e2',
  success: '#22c55e', successSubtle: '#dcfce7', warning: '#d97706', warningSubtle: '#fffbeb',
};

function makeCtx(overrides: Partial<RenderCtx> = {}): RenderCtx {
  return {
    dispatch: vi.fn().mockResolvedValue({ ok: true, components: [] }),
    theme, visitorTimezone: 'UTC', distinctId: 'test-distinctid',
    enabled: { shopify: true, calendar: true, web_call: true },
    formatTime: (iso) => iso, formatDate: () => ({ weekday: 'Mon', day: '10' }),
    ...overrides,
  };
}

const cartFixture: ShopifyCartData = {
  cart_id: 'cart_1',
  lines: [{ line_id: 'l1', variant_id: 'v1', title: '20ft Container', variant_title: 'New',
    image_url: 'https://cdn.shopify.com/img.jpg', quantity: 1,
    line_total: { amount: '3150.00', currency: 'USD' } }],
  subtotal: { amount: '3150.00', currency: 'USD' }, total_quantity: 1,
  discount_codes: [], checkout_url: 'https://store.example.com/cart/checkout?token=abc',
};

describe('ShopifyCartModule', () => {
  it('renders each line item by title', () => {
    const el = ShopifyCartModule.render(cartFixture, makeCtx());
    expect(el.querySelector('[data-part="line-title"]')?.textContent).toBe('20ft Container');
  });

  it('shows the subtotal', () => {
    const el = ShopifyCartModule.render(cartFixture, makeCtx());
    const subtotal = el.querySelector('[data-part="subtotal"]');
    expect(subtotal?.textContent).toContain('3150');
  });

  it('dispatches shopify.remove_line when remove button is clicked', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true, components: [] });
    const el = ShopifyCartModule.render(cartFixture, makeCtx({ dispatch }));
    const removeBtn = el.querySelector('[data-part="remove-line-btn"]') as HTMLButtonElement;
    removeBtn.click();
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      action_type: 'shopify.remove_line',
      payload: expect.objectContaining({ line_id: 'l1' }),
    }));
  });

  it('dispatches shopify.checkout and opens new tab on Checkout click', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true, checkout_url: 'https://store.example.com/cart/checkout?token=abc',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const el = ShopifyCartModule.render(cartFixture, makeCtx({ dispatch }));
    const checkoutBtn = el.querySelector('[data-part="checkout-btn"]') as HTMLButtonElement;
    checkoutBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ action_type: 'shopify.checkout' }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('checkout'), '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('dispatches shopify.apply_discount on discount submit', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true, components: [] });
    const el = ShopifyCartModule.render(cartFixture, makeCtx({ dispatch }));
    const input = el.querySelector('[data-part="discount-input"]') as HTMLInputElement;
    const applyBtn = el.querySelector('[data-part="apply-discount-btn"]') as HTMLButtonElement;
    input.value = 'SAVE10';
    applyBtn.click();
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      action_type: 'shopify.apply_discount',
      payload: { code: 'SAVE10' },
    }));
  });

  it('renders an inline checkout link when the popup is blocked', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true, checkout_url: 'https://store.example.com/cart/checkout?token=abc',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const el = ShopifyCartModule.render(cartFixture, makeCtx({ dispatch }));
    const checkoutBtn = el.querySelector('[data-part="checkout-btn"]') as HTMLButtonElement;
    checkoutBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    const link = el.querySelector('[data-part="checkout-fallback-link"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('checkout');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
    expect(link.textContent).toContain('Open checkout');
    openSpy.mockRestore();
  });

  it('shows inline error when dispatch returns ok:false', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: false, error: { code: 'DISCOUNT_INVALID', message: 'Code not valid', recoverable: true },
    });
    const el = ShopifyCartModule.render(cartFixture, makeCtx({ dispatch }));
    const applyBtn = el.querySelector('[data-part="apply-discount-btn"]') as HTMLButtonElement;
    applyBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    const errorEl = el.querySelector('[data-part="action-error"]');
    expect(errorEl?.textContent).toContain('Code not valid');
  });
});
