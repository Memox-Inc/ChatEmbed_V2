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
