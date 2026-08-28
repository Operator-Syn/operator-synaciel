import { useEffect } from "react";
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
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  robots?: string;
};

export default function GlobalHeadManager({
  title,
  description,
  image,
  url,
  jsonLd,
  robots,
}: HeadProps) {
  useEffect(() => {
    const pageUrl = url || window.location.href;
    const pagePath = new URL(pageUrl, window.location.href).pathname;
    const routeMetadata = getSocialPreviewMetadata(pagePath);
    const socialImage = image || getSocialPreviewImageUrl(pagePath);

    // Document title
    if (title) document.title = `${title} | Syn-Forge`;

    // Meta description
    if (description) {
      let meta = document.getElementById("meta-description") as HTMLMetaElement | null;
      if (meta) meta.content = description;
      else {
        meta = document.createElement("meta");
        meta.id = "meta-description";
        meta.name = "description";
        meta.content = description;
        document.head.appendChild(meta);
      }
    }

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

    setMetaProperty("og:title", title ? `${title} | Syn-Forge` : undefined);
    setMetaProperty("og:description", description);
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

    setMetaName("twitter:title", title ? `${title} | Syn-Forge` : undefined);
    setMetaName("twitter:description", description);
    setMetaName("twitter:image", socialImage);
    setMetaName("twitter:card", "summary_large_image");
    if (robots) {
      setMetaName("robots", robots);
    } else {
      const robotsTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (robotsTag) robotsTag.content = "index, follow";
    }

    document
      .querySelectorAll('script[type="application/ld+json"][data-global-head-manager="true"]')
      .forEach((script) => {
        script.remove();
      });

    const structuredData = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

    structuredData.forEach((entry) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-global-head-manager", "true");
      script.textContent = JSON.stringify(entry);
      document.head.appendChild(script);
    });
  }, [title, description, image, url, jsonLd, robots]);

  return null;
}
