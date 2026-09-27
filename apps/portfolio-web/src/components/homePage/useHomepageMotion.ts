import { useEffect, useState } from "react";

export default function useHomepageMotion() {
  const [isMotionReady, setIsMotionReady] = useState(false);

  useEffect(() => {
    if (document.documentElement.dataset.pageTransitionId) return;
    const frameId = window.requestAnimationFrame(() => setIsMotionReady(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return { isMotionReady };
}
