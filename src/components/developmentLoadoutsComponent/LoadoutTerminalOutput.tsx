import { useMemo } from "react";
import AsyncImage from "../asyncImageLoader/AsyncImage";

interface LoadoutTerminalOutputProps {
  category: string;
  badges: string[];
}

export default function LoadoutTerminalOutput({ category, badges }: LoadoutTerminalOutputProps) {
  const cleanBadges = useMemo(() => badges.filter(Boolean), [badges]);

  if (cleanBadges.length === 0) {
    return <div className="border border-line p-5 text-text-muted">No tools configured.</div>;
  }

  return (
    <ul
      className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3"
      aria-label={`${category} tools`}
    >
      {cleanBadges.map((badgeUrl) => (
        <li key={`${category}-${badgeUrl}`}>
          <AsyncImage
            src={badgeUrl}
            alt={`${category} tool`}
            wrapperClassName="flex min-h-11 items-center justify-center border border-line bg-surface-raised px-2 py-2"
            className="max-h-6 max-w-full object-contain"
          />
        </li>
      ))}
    </ul>
  );
}
