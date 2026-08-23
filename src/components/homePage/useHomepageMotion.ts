import { useEffect, useState } from "react";

export type HomeSectionIndex = 0 | 1 | 2;

const HOME_SECTION_SELECTOR = "[data-home-section-index]";

function readHomeSectionIndex(value: string | null): HomeSectionIndex | null {
  if (value === "0") return 0;
  if (value === "1") return 1;
  if (value === "2") return 2;
  return null;
}

export default function useHomepageMotion() {
  const [isMotionReady, setIsMotionReady] = useState(false);
  const [activeSection, setActiveSection] = useState<HomeSectionIndex>(0);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsMotionReady(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const sections = Array.from(document.querySelectorAll(HOME_SECTION_SELECTOR));
    if (sections.length === 0) return;

    const visibleSections = new Set<Element>();
    let scrollFrameId: number | null = null;
    const syncActiveSection = () => {
      const isAtPageEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const activeElement = isAtPageEnd
        ? sections.at(-1)
        : [...visibleSections].sort(
            (left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top,
          )[0];
      const nextSection = readHomeSectionIndex(
        activeElement?.getAttribute("data-home-section-index") ?? null,
      );

      if (nextSection !== null) {
        setActiveSection((current) => (current === nextSection ? current : nextSection));
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.add(entry.target);
          } else {
            visibleSections.delete(entry.target);
          }
        }

        syncActiveSection();
      },
      {
        rootMargin: "-28% 0px -48% 0px",
        threshold: [0, 0.25, 0.5],
      },
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    const handleScroll = () => {
      if (scrollFrameId !== null) return;

      scrollFrameId = window.requestAnimationFrame(() => {
        scrollFrameId = null;
        syncActiveSection();
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollFrameId !== null) window.cancelAnimationFrame(scrollFrameId);
      observer.disconnect();
    };
  }, []);

  return { activeSection, isMotionReady };
}
