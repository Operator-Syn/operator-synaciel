import type { HTMLAttributes, ReactNode } from "react";

interface LoadingRegionProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  children: ReactNode;
}

type LoadingBlockProps = HTMLAttributes<HTMLSpanElement>;

export function LoadingRegion({ children, className = "", label, ...props }: LoadingRegionProps) {
  return (
    <div {...props} aria-busy="true" className={`loading-region ${className}`}>
      <output aria-live="polite" className="sr-only">
        {label}
      </output>
      {children}
    </div>
  );
}

export function LoadingStatus({ label }: { label: string }) {
  return (
    <output aria-live="polite" className="sr-only">
      {label}
    </output>
  );
}

export function LoadingBlock({ className = "", ...props }: LoadingBlockProps) {
  return <span {...props} aria-hidden="true" className={`loading-block ${className}`} />;
}
