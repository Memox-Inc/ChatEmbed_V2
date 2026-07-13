import { describe, it, expect } from 'vitest';
import { formatMoney, withAlpha, mixWithWhite } from './format';

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

describe('mixWithWhite', () => {
  it('returns white (#ffffff) when ratio is 1.0', () => {
    expect(mixWithWhite('#8349ff', 1.0)).toBe('#ffffff');
  });

  it('returns the base color when ratio is 0.0', () => {
    expect(mixWithWhite('#8349ff', 0.0)).toBe('#8349ff');
  });

  it('blends Memox primary toward white at ratio 0.9 (primaryLight derivation)', () => {
    // #8349ff = r=131, g=73, b=255
    // channel blend: Math.round(c + (255 - c) * 0.9)
    // r: Math.round(131 + 124*0.9) = Math.round(131+111.6) = Math.round(242.6) = 243 = f3
    // g: Math.round(73 + 182*0.9)  = Math.round(73+163.8)  = Math.round(236.8) = 237 = ed
    // b: Math.round(255 + 0*0.9)   = 255 = ff
    expect(mixWithWhite('#8349ff', 0.9)).toBe('#f3edff');
  });

  it('blends a green primary toward white', () => {
    // #00ff00 = r=0, g=255, b=0; ratio=0.5
    // r: Math.round(0 + 255*0.5) = 128 = 80
    // g: 255 + 0*0.5 = 255 = ff
    // b: Math.round(0 + 255*0.5) = 128 = 80
    expect(mixWithWhite('#00ff00', 0.5)).toBe('#80ff80');
  });

  it('returns non-6-digit hex inputs unchanged', () => {
    expect(mixWithWhite('#fff', 0.9)).toBe('#fff');
    expect(mixWithWhite('rgb(131,73,255)', 0.9)).toBe('rgb(131,73,255)');
    expect(mixWithWhite('blue', 0.9)).toBe('blue');
  });
});
