import { useEffect, useRef } from "react";
import {
  parseSavedScroll,
  resolveScrollRestore,
  scrollStorageKey,
} from "./archiveScrollRestoration";

/**
 * The pathname the document was served at.
 *
 * A reload of `/projects` must put the reader back where they were; arriving at `/projects`
 * from another route must start at the top. Comparing the mount path with this one answers
 * that without tracking navigation counters — which matters because React's StrictMode runs
 * mount effects twice, so a "first mount" flag would be consumed by the first pass.
 */
const initialPathname = typeof window === "undefined" ? "" : window.location.pathname;

/**
 * Keep an archive page where the reader left it across a reload.
 *
 * Algorithm:
 * 1. While the route is mounted and its rows have rendered, remember the offset and the
 *    document's maximum on every scroll, coalesced to one write per animation frame.
 * 2. Once the rows exist — and only then, when the height is final — apply the saved offset
 *    once, and only when the document was served at this path. Restoring earlier is what
 *    caused the bug this exists for: the browser applied the offset against a skeleton
 *    several hundred pixels short, clamped it, and pinned the reader to the footer.
 * 3. Preserve the exact saved offset, including the end of the page: the reader's position
 *    belongs to them, and a refresh must not choose a different one.
 *
 * The browser's own restoration is turned off once, in `main.tsx`, before the load completes.
 *
 * @param path Route pathname, used as the storage key.
 * @param ready Whether the archive's content has rendered.
 */
export default function useArchiveScrollRestoration(path: string, ready: boolean): void {
  const decidedRef = useRef(false);

  useEffect(() => {
    if (!ready) return;

    let frame = 0;
    const save = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      sessionStorage.setItem(
        scrollStorageKey(path),
        JSON.stringify({ y: Math.round(window.scrollY), max: Math.round(max) }),
      );
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(save);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [path, ready]);

  useEffect(() => {
    if (!ready || decidedRef.current) return;
    decidedRef.current = true;

    // A client-side navigation starts at the top; only a served document restores.
    if (path !== initialPathname) return;

    const saved = parseSavedScroll(sessionStorage.getItem(scrollStorageKey(path)));
    if (saved === null) return;

    const maxOffset = document.documentElement.scrollHeight - window.innerHeight;
    const target = resolveScrollRestore(String(saved.y), maxOffset);
    if (target === null) return;

    window.scrollTo({ top: target, behavior: "auto" });
  }, [path, ready]);
}
