import { ArrowUpRight } from "lucide-react";
import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";

interface SocialLink {
  href: string;
  img: string;
  alt: string;
}

interface SocialLinksComponentProps {
  badges: SocialLink[];
  isLoading?: boolean;
}

export default function SocialLinksComponent({ badges, isLoading }: SocialLinksComponentProps) {
  if (isLoading) {
    return (
      <LoadingRegion
        className="surface-panel p-5 legacy-panel-loading"
        label="Preparing social links"
      >
        <LoadingBlock className="loading-line-title" />
        <LoadingBlock className="loading-line-copy-short" />
      </LoadingRegion>
    );
  }

  return (
    <section className="surface-panel p-5">
      <p className="eyebrow mb-4">Links / 02</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {badges.map((badge) => (
          <a
            aria-label={badge.alt}
            className="group flex items-center justify-between border-b border-line py-2 text-sm text-text-muted transition-colors hover:text-signal"
            href={badge.href}
            key={`${badge.href}-${badge.alt}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>{badge.alt}</span>
            <ArrowUpRight
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              size={15}
            />
          </a>
        ))}
      </div>
    </section>
  );
}
