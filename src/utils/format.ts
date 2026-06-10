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
