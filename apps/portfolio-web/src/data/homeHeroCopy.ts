/**
 * The home hero's heading and kicker.
 *
 * The heading is a role statement rather than the site's slogan: a crawler, a link
 * unfurl and a first-time visitor all read the `h1` before anything else, and
 * "Calm Interfaces, Seamless Experiences" says nothing about who the page is for.
 * The slogan moves to the kicker, where it still sets the tone.
 */

/** The page's descriptive heading. Static by design: it must not wait for an API. */
export const HOME_ROLE_LINE = "Software developer building calm, dependable web systems";

/** The hero body paragraph shown when the API returns no pitch sections. Static by design. */
export const HOME_HERO_BODY_FALLBACK =
  "A portfolio of projects, experiments, and the thinking behind them.";

/** The kicker used when the site has neither a phrase nor a mobile phrase. */
export const DEFAULT_HERO_KICKER = "Welcome Visitors!";

/** The separator the owner uses inside `site.headerPhrase` to split tagline from greeting. */
const PHRASE_SEPARATOR = " — ";

export interface HomeHeroCopy {
  /** Always `HOME_ROLE_LINE`. */
  title: string;
  /** The tagline from `site.headerPhrase`, or the best available fallback. */
  kicker: string;
}

/**
 * Build the hero copy from the site settings the API returns.
 *
 * Algorithm:
 * 1. Take `headerPhrase`, trimmed.
 * 2. If it contains `" — "`, the tagline is everything before it; otherwise the
 *    whole phrase is the tagline.
 * 3. The first non-empty of: that tagline, `mobileHeaderPhrase`, the default.
 * 4. The title is always the role line.
 *
 * @param site The `site` object from `GET /api/home`; both phrase fields may be
 *   missing, empty, or whitespace.
 * @returns The heading and kicker. Never throws.
 */
export function getHeroCopy(site: {
  headerPhrase?: string;
  mobileHeaderPhrase?: string;
}): HomeHeroCopy {
  const phrase = site.headerPhrase?.trim() ?? "";
  const separatorIndex = phrase.indexOf(PHRASE_SEPARATOR);
  const tagline = separatorIndex === -1 ? phrase : phrase.slice(0, separatorIndex).trim();
  // A phrase made only of separators ("—", " - ") has no tagline to show; using it
  // as-is would print a bare dash as the kicker.
  const hasTagline = tagline.replace(/[\s\u2014\u2013-]+/g, "").length > 0;

  return {
    title: HOME_ROLE_LINE,
    kicker: hasTagline ? tagline : site.mobileHeaderPhrase?.trim() || DEFAULT_HERO_KICKER,
  };
}
