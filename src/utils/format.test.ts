import { describe, it, expect } from 'vitest';
import { formatMoney, withAlpha } from './format';

describe('formatMoney', () => {
  it('formats a USD amount with a currency symbol and no digit grouping', () => {
    const out = formatMoney('3500.00', 'USD');
    expect(out).toContain('3500');
    expect(out).toContain('$');
  });

  it('formats EUR without a dollar sign', () => {
    const out = formatMoney('2999.00', 'EUR');
    expect(out).toContain('2999');
    expect(out).not.toContain('$');
  });

  it('falls back to the raw pair for a NaN amount', () => {
    expect(formatMoney('not-a-number', 'USD')).toBe('USD not-a-number');
  });

  it('falls back to the raw pair for an invalid currency code', () => {
    expect(formatMoney('10.00', 'NOPE!')).toBe('NOPE! 10.00');
  });
});

describe('withAlpha', () => {
  it('appends the alpha suffix to a 6-digit hex color', () => {
    expect(withAlpha('#ffffff', 'cc')).toBe('#ffffffcc');
    expect(withAlpha('#EF4444', '66')).toBe('#EF444466');
  });

  it('returns non-hex colors unchanged (no alpha)', () => {
    expect(withAlpha('rgb(255,255,255)', 'cc')).toBe('rgb(255,255,255)');
    expect(withAlpha('hsl(0, 0%, 100%)', 'cc')).toBe('hsl(0, 0%, 100%)');
    expect(withAlpha('#fff', 'cc')).toBe('#fff');
  });
});
