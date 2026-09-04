import { type ReactNode, useCallback, useMemo, useState } from "react";
import { FloatingControlsContext, type FloatingPanel } from "./FloatingControlsContext";

export function FloatingControlsProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<FloatingPanel | null>(null);

  const openPanel = useCallback((panel: FloatingPanel) => {
    setActivePanel(panel);
  }, []);

  const closePanel = useCallback((panel: FloatingPanel) => {
    setActivePanel((current) => (current === panel ? null : current));
  }, []);

  const value = useMemo(
    () => ({
      activePanel,
      closePanel,
      openPanel,
    }),
    [activePanel, closePanel, openPanel],
  );

  return (
    <FloatingControlsContext.Provider value={value}>{children}</FloatingControlsContext.Provider>
  );
}
