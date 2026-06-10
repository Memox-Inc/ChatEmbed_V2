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

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const chip = createCartChip(1, onClick, '#8349ff', '#f0ebff');
    chip.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
