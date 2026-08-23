import type { ReactNode } from "react";

interface CookingAreaProps {
  children?: ReactNode;
}

export default function CookingArea({ children }: CookingAreaProps) {
  return <div className="page-frame-wide">{children}</div>;
}
