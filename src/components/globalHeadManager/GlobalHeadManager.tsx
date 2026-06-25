import { useEffect } from "react";

type HeadProps = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

export default function GlobalHeadManager({ title, description, image, url, jsonLd }: HeadProps) {
  useEffect(() => {
    const pageUrl = url || window.location.href;

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
    setMetaProperty("og:image", image);
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
    setMetaName("twitter:image", image);
    setMetaName("twitter:card", "summary_large_image");

    document
      .querySelectorAll('script[type="application/ld+json"][data-global-head-manager="true"]')
      .forEach((script) => script.remove());

    const structuredData = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

    structuredData.forEach((entry) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-global-head-manager", "true");
      script.textContent = JSON.stringify(entry);
      document.head.appendChild(script);
    });
  }, [title, description, image, url, jsonLd]);

  return null;
}
