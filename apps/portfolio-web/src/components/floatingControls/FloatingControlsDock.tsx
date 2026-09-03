import type { ReactNode } from "react";
import { useFloatingControls } from "./useFloatingControls";

type FloatingControlsDockProps = {
  children: ReactNode;
};

export default function FloatingControlsDock({ children }: FloatingControlsDockProps) {
  const { activePanel } = useFloatingControls();

  return (
    <div className="floating-control-dock" data-active-panel={activePanel ?? "none"}>
      {children}
    </div>
  );
}
