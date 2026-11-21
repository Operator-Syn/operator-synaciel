/**
 * Cloudflare image transformation URLs for media served from the R2 bucket.
 *
 * The site renders full-size uploads — a 900 KB PNG painted into a 487 px box — and
 * the media zone has transformations enabled, so a URL can ask the edge for a sized,
 * modern-format copy of the same object. `format=auto` negotiates AVIF or WebP from
 * the request's `Accept` header and falls back to the stored object.
 */

/** The only host whose objects the transformation endpoint can serve. */
const MEDIA_HOSTNAME = "personal-portfolio-bucket.syn-forge.com";

/** Edge transform options that stay constant across call sites. */
const DEFAULT_QUALITY = 78;

/**
 * Whether a URL points at an object this site can ask the edge to resize.
 *
 * The host is compared by parsing, not by prefix: a prefix test would also accept
 * `personal-portfolio-bucket.syn-forge.com.evil.test`, which is a different host.
 *
 * @param url Absolute or relative URL as stored in the API payload.
 * @returns True only for `https:` URLs on the media host that carry no query or
 *   fragment, since neither survives the transform rebuild.
 */
export function isTransformable(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // A query or fragment cannot survive the rebuild, so such a URL is not transformable
  // either — the predicate has to agree with `resizeImage`, not merely describe the host.
  if (parsed.search || parsed.hash) return false;

  return parsed.protocol === "https:" && parsed.hostname === MEDIA_HOSTNAME;
}

/**
 * Optional shape for the transform.
 *
 * Supplying `height` together with `fit` makes the output a fixed canvas, which is what
 * normalises media whose source files arrive at different aspect ratios. A `height`
 * without a `fit` is dropped on purpose: the service's default fit is `scale`, which
 * would use both dimensions and distort the image.
 */
export interface TransformShape {
  /** Canvas height; supplied together with a `fit` to make the output uniform. */
  height?: number;
  /** `pad` keeps the whole image and fills the remainder; `crop` discards the overflow. */
  fit?: "pad" | "crop";
  /** Fill colour for the padded area. `transparent` preserves alpha through AVIF. */
  background?: "transparent";
}

/**
 * Build a resized, format-negotiated URL for one media object.
 *
 * Algorithm:
 * 1. Refuse anything that is not an `https:` URL on the media host → `null`.
 * 2. Refuse a URL that is already a transformation → `null`, so a caller cannot nest
 *    `/cdn-cgi/image/` inside itself.
 * 3. Otherwise insert `/cdn-cgi/image/<options>/` before the object path, where the
 *    options always carry `width`, `format=auto` and `quality`, and add `height`,
 *    `fit` and `background` only when `shape` supplies a height together with a fit.
 * 4. Return the composed URL.
 *
 * Returning `null` rather than the input is deliberate: callers gate their image
 * attributes on whether a transform happened, so "unchanged URL" and "no transform"
 * must be distinguishable.
 *
 * @param url The object URL from the API.
 * @param width Target pixel width.
 * @param quality Encoder quality, 1-100; defaults to 78.
 * @param shape Optional canvas options for normalising differing source ratios.
 * @returns The transformed URL, or `null` when this object cannot be transformed.
 */
export function resizeImage(
  url: string,
  width: number,
  quality = DEFAULT_QUALITY,
  shape: TransformShape = {},
): string | null {
  if (!isTransformable(url)) return null;

  const parsed = new URL(url);
  if (parsed.pathname.startsWith("/cdn-cgi/image/")) return null;

  // Order matters only for readability; every option is optional except width, so a
  // call without `shape` produces exactly the URL this function produced before.
  const parts = [`width=${width}`, `format=auto`, `quality=${quality}`];
  if (shape.height !== undefined && shape.fit) {
    parts.splice(1, 0, `height=${shape.height}`, `fit=${shape.fit}`);
    if (shape.background) parts.splice(3, 0, `background=${shape.background}`);
  }
  const options = parts.join(",");
  return `${parsed.origin}/cdn-cgi/image/${options}${parsed.pathname}`;
}
