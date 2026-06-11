import { describe, it, expect, vi } from 'vitest';
import { createCartChip } from './cart-chip';

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
});
