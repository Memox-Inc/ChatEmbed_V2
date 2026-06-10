import { describe, it, expect, vi } from 'vitest';
import { ShopifyProductCardModule } from './product-card';
import type { ShopifyProductCardData, RenderCtx, ThemeTokens } from '../../core/types';

const theme: ThemeTokens = {
  primary: '#8349ff', primaryLight: '#f0ebff', text: '#072032',
  textMuted: '#5b6b7a', border: '#e5e7eb', surface: '#fff',
  surfaceSubtle: '#f9fafb', error: '#ef4444', errorSubtle: '#fee2e2',
  success: '#22c55e', successSubtle: '#dcfce7', warning: '#d97706', warningSubtle: '#fffbeb',
};

function makeCtx(overrides: Partial<RenderCtx> = {}): RenderCtx {
  return {
    dispatch: vi.fn().mockResolvedValue({ ok: true, components: [] }),
    theme,
    visitorTimezone: 'UTC', distinctId: 'test-id',
    enabled: { shopify: true, calendar: true, web_call: true },
    formatTime: (iso) => iso, formatDate: () => ({ weekday: 'Mon', day: '10' }),
    ...overrides,
  };
}

const baseProduct: ShopifyProductCardData = {
  product_id: 'prod_1', handle: '20ft-standard',
  title: '20ft Standard Shipping Container',
  image_url: 'https://cdn.shopify.com/img.jpg',
  url: 'https://store.example.com/products/20ft-standard',
  price: { amount: '3150.00', currency: 'USD' },
  compare_at_price: { amount: '3500.00', currency: 'USD' },
  variants: [
    { id: 'v1', title: 'New', available: true, price: { amount: '3150.00', currency: 'USD' } },
    { id: 'v2', title: 'Used', available: false, price: { amount: '2100.00', currency: 'USD' } },
  ],
  selected_variant_id: 'v1', available: true, badge: 'In Stock',
};

describe('ShopifyProductCardModule', () => {
  it('renders product title as text (not parsed HTML)', () => {
    const el = ShopifyProductCardModule.render(baseProduct, makeCtx());
    const title = el.querySelector('[data-part="product-title"]');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('20ft Standard Shipping Container');
  });

  it('renders variant pills for each variant', () => {
    const el = ShopifyProductCardModule.render(baseProduct, makeCtx());
    const pills = el.querySelectorAll('[data-part="variant-pill"]');
    expect(pills).toHaveLength(2);
  });

  it('marks selected variant pill', () => {
    const el = ShopifyProductCardModule.render(baseProduct, makeCtx());
    const selected = el.querySelector('[data-part="variant-pill"][data-selected="true"]');
    expect(selected?.textContent?.trim()).toBe('New');
  });

  it('disables Add to Cart for unavailable variant', () => {
    const oos = { ...baseProduct, available: false, variants: [{ id: 'v1', title: 'Size XL', available: false, price: { amount: '3150.00', currency: 'USD' } }], selected_variant_id: 'v1' };
    const el = ShopifyProductCardModule.render(oos, makeCtx());
    const btn = el.querySelector('[data-part="add-to-cart-btn"]') as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it('shows out-of-stock overlay when available is false', () => {
    const oos = { ...baseProduct, available: false };
    const el = ShopifyProductCardModule.render(oos, makeCtx());
    const overlay = el.querySelector('[data-part="oos-overlay"]');
    expect(overlay).not.toBeNull();
  });

  it('dispatches shopify.add_to_cart on Add to Cart click', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true, components: [] });
    const el = ShopifyProductCardModule.render(baseProduct, makeCtx({ dispatch }));
    const btn = el.querySelector('[data-part="add-to-cart-btn"]') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      action_type: 'shopify.add_to_cart',
      payload: expect.objectContaining({ variant_id: 'v1', quantity: 1 }),
    }));
  });

  it('renders compare_at_price with strikethrough when present', () => {
    const el = ShopifyProductCardModule.render(baseProduct, makeCtx());
    const compare = el.querySelector('[data-part="compare-price"]');
    expect(compare).not.toBeNull();
    expect(compare!.textContent).toContain('3500');
  });

  it('renders badge text when badge is non-null', () => {
    const el = ShopifyProductCardModule.render(baseProduct, makeCtx());
    const badge = el.querySelector('[data-part="badge"]');
    expect(badge?.textContent?.trim()).toBe('In Stock');
  });

  it('renders a EUR price with euro formatting, not a dollar sign', () => {
    const eur: ShopifyProductCardData = {
      ...baseProduct,
      price: { amount: '2999.00', currency: 'EUR' },
      compare_at_price: null,
    };
    const el = ShopifyProductCardModule.render(eur, makeCtx());
    const price = el.querySelector('[data-part="price"]');
    expect(price).not.toBeNull();
    expect(price!.textContent).toContain('2999');
    expect(price!.textContent).not.toContain('$');
  });

  it('renders a single card as the root element (carousel grouping lives in renderComponentsBlock)', () => {
    const el = ShopifyProductCardModule.render(baseProduct, makeCtx());
    expect(el.getAttribute('data-part')).toBe('card');
    expect(el.querySelector('[data-part="carousel"]')).toBeNull();
  });
});
