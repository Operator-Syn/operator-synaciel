import { ArrowUpRight } from "lucide-react";
import type { MediaItem } from "../../types/MediaCardTypes";
import MediaRenderer from "../mediaRenderer/MediaRenderer";

interface MediaCardProps {
  project: MediaItem;
  index: number;
  onClick: (project: MediaItem) => void;
}

export default function MediaCard({ project, index, onClick }: MediaCardProps) {
  return (
    <article className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-b border-line py-5 sm:grid-cols-[5rem_minmax(12rem,0.8fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="font-display text-4xl text-text-muted sm:text-5xl">
        {String(index + 1).padStart(2, "0")}
      </div>

      <button
        aria-label={`Open ${project.title}`}
        className="group relative aspect-video w-full overflow-hidden border border-line bg-surface-raised text-left sm:col-span-1"
        data-cursor="zoom-in"
        data-project-id={project.id}
        onClick={() => onClick(project)}
        type="button"
      >
        <MediaRenderer
          type={project.type}
          url={project.url}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </button>

      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="meta-label mb-2">{project.type}</p>
        <h2 className="text-2xl leading-tight text-text sm:text-3xl">{project.title}</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
          {project.shortDescription}
        </p>
      </div>

      <button
        aria-label={`View details for ${project.title}`}
        className="col-start-2 inline-flex items-center gap-2 justify-self-start font-mono text-meta uppercase tracking-[0.06em] text-signal transition-colors hover:text-signal-strong sm:col-start-auto sm:justify-self-end"
        onClick={() => onClick(project)}
        type="button"
      >
        View details
        <ArrowUpRight aria-hidden="true" size={17} />
      </button>
    </article>
  );
}
