import { ArrowDownRight } from "lucide-react";
import { LoadingBlock, LoadingRegion } from "../loadingState/LoadingState";
import TransitionLink from "../pageTransition/TransitionLink";

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
      <LoadingRegion className="header-loading" label="Preparing page introduction">
        <LoadingBlock className="header-loading-title" />
        <LoadingBlock className="header-loading-kicker" />
      </LoadingRegion>
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
      <TransitionLink
        className="signal-link mt-8 inline-flex items-center gap-2 font-mono text-meta uppercase tracking-[0.06em]"
        to="/projects"
      >
        Explore the archive
        <ArrowDownRight aria-hidden="true" size={16} />
      </TransitionLink>
    </div>
  );
}
