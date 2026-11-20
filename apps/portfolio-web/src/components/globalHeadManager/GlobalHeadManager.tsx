import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  getSocialPreviewImageUrl,
  getSocialPreviewMetadata,
  SOCIAL_PREVIEW_CONTENT_TYPE,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_WIDTH,
} from "../../data/socialPreview";

type HeadProps = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  /**
   * Accepted for call-site compatibility and deliberately not emitted.
   *
   * JSON-LD is owned by the Pages middleware now. Emitting a graph here would
   * append a second one after hydration, which is exactly the duplication the
   * server-side graph exists to remove. The prop stays in the type so existing
   * pages keep type-checking until their call sites drop it.
   */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  robots?: string;
};

export default function GlobalHeadManager({ title, description, image, url, robots }: HeadProps) {
  // The router location is the trigger for in-place URL changes (for example a
  // snippet document canonicalising its slug), so the head re-resolves even
  // when a call site does not pass `url`.
  const location = useLocation();

  useEffect(() => {
    // `location.pathname` is the re-run trigger below, so an in-place route
    // change re-derives the head. Search/hash are appended only to keep the URL
    // shape identical to `window.location.href`; they do not trigger the effect.
    const pageUrl =
      url ||
      `${window.location.origin}${location.pathname}${window.location.search}${window.location.hash}`;
    const pagePath = new URL(pageUrl, window.location.href).pathname;
    const routeMetadata = getSocialPreviewMetadata(pagePath);
    const socialImage = image || getSocialPreviewImageUrl(pagePath);
    // The metadata map is the single owner. A page only needs to pass these
    // props when the map cannot describe it (the 404 route, which must not
    // inherit the home route's metadata).
    const resolvedTitle = title ?? routeMetadata.title;
    const resolvedDescription = description ?? routeMetadata.description;

    // Document title
    document.title = `${resolvedTitle} | Syn-Forge`;

    // Meta description: the middleware writes one without an id, so it is
    // found by selector and updated in place. Appending unconditionally left
    // served pages with two description tags.
    let descriptionTag = document.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.name = "description";
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.content = resolvedDescription;

    // OpenGraph tags
    const setMetaProperty = (property: string, content?: string) => {
      if (!content) return;
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    setMetaProperty("og:title", `${resolvedTitle} | Syn-Forge`);
    setMetaProperty("og:description", resolvedDescription);
    setMetaProperty("og:image", socialImage);
    setMetaProperty("og:image:secure_url", socialImage);
    setMetaProperty("og:image:type", SOCIAL_PREVIEW_CONTENT_TYPE);
    setMetaProperty("og:image:width", String(SOCIAL_PREVIEW_WIDTH));
    setMetaProperty("og:image:height", String(SOCIAL_PREVIEW_HEIGHT));
    setMetaProperty("og:image:alt", routeMetadata.imageAlt);
    setMetaProperty("og:url", pageUrl);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;

    // Twitter card tags
    const setMetaName = (name: string, content?: string) => {
      if (!content) return;
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    setMetaName("twitter:title", `${resolvedTitle} | Syn-Forge`);
    setMetaName("twitter:description", resolvedDescription);
    setMetaName("twitter:image", socialImage);
    setMetaName("twitter:card", "summary_large_image");
    if (robots) {
      setMetaName("robots", robots);
    } else {
      const robotsTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (robotsTag) robotsTag.content = "index, follow";
    }
  }, [title, description, image, url, robots, location.pathname]);

  return null;
}
