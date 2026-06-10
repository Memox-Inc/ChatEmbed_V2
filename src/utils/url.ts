/**
 * Allow only http(s) and data: URLs for launcher images. Server uploads
 * always produce https URLs; data: lets us inline tiny placeholders for
 * previews. For data: URLs, only allow safe raster formats (png, jpeg,
 * gif, webp). Reject data:image/svg+xml to prevent embedded JavaScript.
 * Anything else (javascript:, file:, ...) is rejected.
 */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return /^https?:\/\//.test(url) || /^data:image\/(png|jpeg|gif|webp);/.test(url);
}

/**
 * Strict https-only check for outbound links rendered from server data
 * (e.g. the product card's View on store link). Unlike isSafeImageUrl this
 * rejects http and data: outright: a link the visitor clicks must never
 * downgrade transport or smuggle a non-network scheme.
 */
export function isSafeHttpsUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\//i.test(url);
}
