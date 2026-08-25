import { ListTree } from "lucide-react";
import { useEffect, useState } from "react";

import type { MarkdownHeading } from "./markdownHeadings";

type SnippetDocumentTocProps = {
  headings: MarkdownHeading[];
};

type TocLinksProps = {
  activeId: string;
  headings: MarkdownHeading[];
  onNavigate: (id: string) => void;
};

function TocLinks({ activeId, headings, onNavigate }: TocLinksProps) {
  return (
    <ol className="snippet-document-toc-list">
      {headings.map((heading) => (
        <li data-level={heading.level} key={heading.id}>
          <a
            aria-current={activeId === heading.id ? "location" : undefined}
            className="snippet-document-toc-link"
            data-cursor="alias"
            href={`#${heading.id}`}
            onClick={() => onNavigate(heading.id)}
          >
            {heading.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

export default function SnippetDocumentToc({ headings }: SnippetDocumentTocProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    setActiveId(headings[0]?.id ?? "");

    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) return;

    const updateActiveHeading = () => {
      const headingWindowTop = Math.min(96, window.innerHeight * 0.18);
      const positions = elements.map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
      }));
      const passedHeading = positions.filter(({ rect }) => rect.top <= headingWindowTop).at(-1);
      const visibleHeading = positions.find(
        ({ rect }) => rect.bottom > headingWindowTop && rect.top < window.innerHeight,
      );
      const activeHeading =
        passedHeading && passedHeading.rect.bottom > headingWindowTop
          ? passedHeading
          : (visibleHeading ?? passedHeading ?? positions[0]);

      setActiveId((currentId) =>
        currentId === activeHeading.element.id ? currentId : activeHeading.element.id,
      );
    };

    let frameId = 0;
    const scheduleActiveHeadingUpdate = () => {
      if (frameId !== 0) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateActiveHeading();
      });
    };

    updateActiveHeading();
    window.addEventListener("scroll", scheduleActiveHeadingUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveHeadingUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleActiveHeadingUpdate);
      window.removeEventListener("resize", scheduleActiveHeadingUpdate);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, [headings]);

  const handleNavigate = (id: string) => {
    setActiveId(id);
  };

  return (
    <div className="snippet-document-toc-layer">
      <aside aria-label="On this page" className="snippet-document-toc">
        <div className="snippet-document-toc-heading">
          <span>
            <ListTree aria-hidden="true" size={16} />
            On this page
          </span>
          <span className="snippet-document-toc-count">
            {headings.length.toString().padStart(2, "0")} sections
          </span>
        </div>
        <nav aria-label="Document sections">
          <TocLinks activeId={activeId} headings={headings} onNavigate={handleNavigate} />
        </nav>
      </aside>

      <details className="snippet-document-toc-mobile">
        <summary>
          <span>
            <ListTree aria-hidden="true" size={16} />
            Contents
          </span>
          <span className="snippet-document-toc-count">
            {headings.length.toString().padStart(2, "0")} sections
          </span>
        </summary>
        <nav aria-label="Document sections">
          <TocLinks activeId={activeId} headings={headings} onNavigate={handleNavigate} />
        </nav>
      </details>
    </div>
  );
}
