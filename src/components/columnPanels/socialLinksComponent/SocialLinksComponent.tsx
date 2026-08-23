import { ArrowUpRight } from "lucide-react";

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
      <div className="surface-panel animate-pulse p-5" aria-hidden="true">
        <div className="h-4 w-1/2 bg-surface-raised" />
        <div className="mt-4 h-4 w-4/5 bg-surface-raised" />
      </div>
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
