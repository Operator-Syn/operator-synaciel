import { useEffect } from "react";

type HeadProps = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
};

export default function GlobalHeadManager({ title, description, image, url }: HeadProps) {
  useEffect(() => {
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
    setMetaProperty("og:url", url || window.location.href);

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
  }, [title, description, image, url]);

  return null;
}