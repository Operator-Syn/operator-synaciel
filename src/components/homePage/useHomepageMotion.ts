import { useEffect, useState } from "react";

export default function useHomepageMotion() {
  const [isMotionReady, setIsMotionReady] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsMotionReady(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return { isMotionReady };
}
