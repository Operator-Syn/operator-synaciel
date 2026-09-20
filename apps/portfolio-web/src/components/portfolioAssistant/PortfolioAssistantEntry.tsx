import { MessageCircle } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useFloatingControls } from "../floatingControls/useFloatingControls";

const LazyPortfolioAssistant = lazy(() => import("./PortfolioAssistantFab"));

export default function PortfolioAssistantFab() {
  const { activePanel, openPanel } = useFloatingControls();
  const [loaded, setLoaded] = useState(false);
  const isOpen = activePanel === "assistant";

  const handleOpen = () => {
    setLoaded(true);
    openPanel("assistant");
  };

  return (
    <div className="portfolio-assistant-entry" data-floating-panel="assistant">
      {loaded ? (
        <Suspense
          fallback={isOpen ? <span aria-live="polite">Loading portfolio assistant</span> : null}
        >
          <LazyPortfolioAssistant hideFab />
        </Suspense>
      ) : null}
      {!isOpen ? (
        <button
          aria-controls="portfolio-assistant-panel"
          aria-expanded={false}
          aria-label="Open portfolio assistant"
          className="portfolio-assistant-fab"
          onClick={handleOpen}
          title="Portfolio assistant"
          type="button"
        >
          <MessageCircle aria-hidden="true" size={20} />
        </button>
      ) : null}
    </div>
  );
}
