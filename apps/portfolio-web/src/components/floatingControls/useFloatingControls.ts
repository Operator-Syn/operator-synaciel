import { useContext } from "react";
import { FloatingControlsContext } from "./FloatingControlsContext";

export function useFloatingControls() {
  const context = useContext(FloatingControlsContext);
  if (!context) {
    throw new Error("useFloatingControls must be used within FloatingControlsProvider");
  }
  return context;
}
