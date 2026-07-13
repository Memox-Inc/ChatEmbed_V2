import { describe, it, expect, vi } from 'vitest';
import { createCartChip, updateCartChip, syncCartChipOnComponentUpdate } from './cart-chip';

describe('createCartChip()', () => {
  it('renders with item count', () => {
    const chip = createCartChip(3, vi.fn(), '#8349ff', '#f0ebff');
    expect(chip.querySelector('[data-part="chip-count"]')?.textContent?.trim()).toBe('3');
  });

  it('shows badge when count > 0', () => {
    const chip = createCartChip(2, vi.fn(), '#8349ff', '#f0ebff');
    const badge = chip.querySelector('[data-part="chip-badge"]');
    expect(badge?.textContent?.trim()).toBe('2');
  });

  it('badge count uses the light token, never an alpha tint of primary', () => {
    const chip = createCartChip(2, vi.fn(), '#8349ff', '#f0ebff');
    const badge = chip.querySelector('[data-part="chip-badge"]') as HTMLElement;
    // jsdom may normalize hex colors to rgb() form; accept either.
    expect(['#f0ebff', 'rgb(240, 235, 255)']).toContain(badge.style.color);
    // Must not be primary or a withAlpha(primary, ...) derivative, which
    // would be near-invisible on the solid-primary badge background.
    expect(badge.style.color).not.toContain('131, 73, 255');
    expect(badge.style.color.toLowerCase()).not.toContain('#8349ff');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const chip = createCartChip(1, onClick, '#8349ff', '#f0ebff');
    chip.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('creates the badge on update from zero using the stored token colors', () => {
    const chip = createCartChip(0, vi.fn(), '#8349ff', '#f0ebff');
    expect(chip.querySelector('[data-part="chip-badge"]')).toBeNull();
    updateCartChip(chip, 3);
    const badge = chip.querySelector('[data-part="chip-badge"]') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('3');
    expect(['#f0ebff', 'rgb(240, 235, 255)']).toContain(badge.style.color);
    expect(['#8349ff', 'rgb(131, 73, 255)']).toContain(badge.style.backgroundColor);
  });
});

describe('syncCartChipOnComponentUpdate()', () => {
  // Mirrors the DOM structure message-integration stamps: a message wrapper
  // carrying data-message-id, containing a component wrapper carrying
  // data-component-id + data-component-type.
  function makeMessagesDom(componentType: string): HTMLElement {
    const messagesEl = document.createElement('div');
    const msg = document.createElement('div');
    msg.setAttribute('data-message-id', 'msg_1');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-component-id', 'cmp_1');
    wrapper.setAttribute('data-component-type', componentType);
    msg.appendChild(wrapper);
    messagesEl.appendChild(msg);
    return messagesEl;
  }

  it('updates the chip badge when the target component is a shopify_cart', () => {
    const messagesEl = makeMessagesDom('shopify_cart');
    const chip = createCartChip(1, vi.fn(), '#8349ff', '#f0ebff');
    syncCartChipOnComponentUpdate(
      messagesEl, 'msg_1', 'cmp_1', { total_quantity: 5 },
      (n) => updateCartChip(chip, n),
    );
    expect(chip.querySelector('[data-part="chip-badge"]')?.textContent?.trim()).toBe('5');
  });

  it('does not touch the chip when the target component is not a cart', () => {
    const messagesEl = makeMessagesDom('shopify_product_card');
    const chip = createCartChip(1, vi.fn(), '#8349ff', '#f0ebff');
    syncCartChipOnComponentUpdate(
      messagesEl, 'msg_1', 'cmp_1', { total_quantity: 5 },
      (n) => updateCartChip(chip, n),
    );
    expect(chip.querySelector('[data-part="chip-badge"]')?.textContent?.trim()).toBe('1');
  });

  it('does not sync when no wrapper exists for the ids', () => {
    const messagesEl = makeMessagesDom('shopify_cart');
    const setCount = vi.fn();
    syncCartChipOnComponentUpdate(messagesEl, 'msg_other', 'cmp_1', { total_quantity: 5 }, setCount);
    expect(setCount).not.toHaveBeenCalled();
  });
});
