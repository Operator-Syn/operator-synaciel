import { ArrowDownRight } from "lucide-react";
import { Link } from "react-router-dom";

interface HeaderComponentProps {
  headerPhrase?: string;
  mobileHeaderPhrase?: string;
  isLoading?: boolean;
}

export default function HeaderComponent({
  headerPhrase,
  mobileHeaderPhrase,
  isLoading,
}: HeaderComponentProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-24 w-4/5 bg-surface-raised" />
        <div className="mt-5 h-5 w-2/5 bg-surface-raised" />
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow mb-5">Operator-Syn / portfolio</p>
      <h1 className="max-w-5xl text-display text-text">
        {headerPhrase || mobileHeaderPhrase || "Calm interfaces, seamless experiences."}
      </h1>
      {mobileHeaderPhrase && mobileHeaderPhrase !== headerPhrase && (
        <p className="mt-4 font-mono text-meta uppercase tracking-[0.06em] text-text-muted sm:hidden">
          {mobileHeaderPhrase}
        </p>
      )}
      <Link
        className="signal-link mt-8 inline-flex items-center gap-2 font-mono text-meta uppercase tracking-[0.06em]"
        to="/projects"
      >
        Explore the archive
        <ArrowDownRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
}
