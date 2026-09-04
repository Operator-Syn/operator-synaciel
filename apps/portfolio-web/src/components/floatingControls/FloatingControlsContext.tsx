import { createContext } from "react";

export type FloatingPanel = "assistant" | "settings" | "quick-navigation";

export type FloatingControlsContextValue = {
  activePanel: FloatingPanel | null;
  closePanel: (panel: FloatingPanel) => void;
  openPanel: (panel: FloatingPanel) => void;
};

export const FloatingControlsContext = createContext<FloatingControlsContextValue | null>(null);
