/**
 * Shared formatting helpers for rich component renderers (MMX-468).
 * Used by the shopify family (Tasks 6-8); keep renderer-agnostic.
 */

export function formatMoney(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return `${currency} ${amount}`;
  try {
    // useGrouping: false keeps digits contiguous ("$3500.00", not "$3,500.00").
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      useGrouping: false,
    }).format(num);
  } catch {
    // Unknown/invalid currency code (Intl throws RangeError): raw fallback.
    return `${currency} ${amount}`;
  }
}

/**
 * Append a 2-digit hex alpha suffix to a 6-digit hex color
 * ("#ffffff" + "cc" -> "#ffffffcc"). Theme tokens are hex today, but if a
 * token ever arrives as rgb()/hsl()/shorthand hex, blindly suffixing would
 * produce an invalid color, so non-matching values are returned unchanged
 * (fully opaque) instead.
 */
export function withAlpha(color: string, alphaHex: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${alphaHex}`;
  return color;
}

/**
 * Linearly interpolate each RGB channel of `base` toward white by `ratio`
 * (0 = pure base, 1 = white). Returns a 6-digit lowercase hex string.
 *
 * Used to derive `primaryLight` from `theme.primary` so the tinted
 * background responds to white-label primary color overrides instead of
 * hardcoding a Memox-purple-specific hex.
 *
 * Non-hex inputs (rgb(), hsl(), etc.) are returned unchanged so callers
 * never receive an invalid CSS value — the caller should fall back to a
 * brand-neutral default in that case.
 *
 * @param base    A 6-digit hex color, e.g. "#8349ff".
 * @param ratio   Blend ratio toward white: 0.0–1.0.
 */
export function mixWithWhite(base: string, ratio: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(base)) return base;
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  const blend = (channel: number): string => {
    const mixed = Math.round(channel + (255 - channel) * ratio);
    return mixed.toString(16).padStart(2, '0');
  };
  return `#${blend(r)}${blend(g)}${blend(b)}`;
}
