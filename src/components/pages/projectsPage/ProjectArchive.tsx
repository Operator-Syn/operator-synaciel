import { ArrowRight, Grid2X2 } from "lucide-react";
import type { MediaItem } from "../../../types/MediaCardTypes";
import MediaRenderer from "../../mediaRenderer/MediaRenderer";

interface ProjectArchiveProps {
  projects: MediaItem[];
  startIndex: number;
  onOpenProject: (project: MediaItem) => void;
  isInteractive: (project: MediaItem) => boolean;
}

function ProjectMedia({
  project,
  onOpenProject,
  isInteractive,
}: {
  project: MediaItem;
  onOpenProject: (project: MediaItem) => void;
  isInteractive: boolean;
}) {
  const mediaLabel = `${project.title} preview`;
  const media = (
    <MediaRenderer
      alt={mediaLabel}
      type={project.type}
      url={project.url}
      className="project-archive-media-content"
      cursorState={project.type === "image" && isInteractive ? "zoom-in" : undefined}
    />
  );

  if (project.type === "video" || !isInteractive) {
    return <div className="project-archive-media">{media}</div>;
  }

  return (
    <button
      aria-label={`Open gallery for ${project.title}`}
      className="project-archive-media project-archive-media-button"
      data-cursor="zoom-in"
      onClick={() => onOpenProject(project)}
      type="button"
    >
      {media}
    </button>
  );
}

function ProjectArchiveRow({
  project,
  index,
  onOpenProject,
  isInteractive,
}: {
  project: MediaItem;
  index: number;
  onOpenProject: (project: MediaItem) => void;
  isInteractive: boolean;
}) {
  const projectNumber = String(index + 1).padStart(2, "0");
  const titleId = `project-archive-title-${project.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className="project-archive-row"
      data-cursor={isInteractive ? "cell" : undefined}
      onClick={(event) => {
        if (
          !isInteractive ||
          (event.target instanceof Element && event.target.closest("a, button, video"))
        ) {
          return;
        }

        onOpenProject(project);
      }}
      onKeyDown={(event) => {
        if (
          !isInteractive ||
          (event.target instanceof Element && event.target.closest("a, button, video")) ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }

        event.preventDefault();
        onOpenProject(project);
      }}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="project-archive-index-wrap">
        <p className="project-archive-index">{projectNumber}</p>
        <span className="meta-label project-archive-mobile-type">{project.type}</span>
      </div>

      <ProjectMedia isInteractive={isInteractive} onOpenProject={onOpenProject} project={project} />

      <div className="project-archive-copy">
        <h2 id={titleId}>{project.title}</h2>
        <p>{project.shortDescription}</p>
      </div>

      <aside className="project-archive-actions">
        <p className="meta-label project-archive-desktop-type">{project.type}</p>

        {!isInteractive ? (
          <span className="meta-label">Coming soon</span>
        ) : project.projectLink ? (
          <a
            className="project-archive-project-link"
            href={project.projectLink}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>View project</span>
            <ArrowRight aria-hidden="true" size={17} />
          </a>
        ) : (
          <span className="meta-label">Project link unavailable</span>
        )}

        {isInteractive && (
          <button
            aria-label={`Gallery / case study for ${project.title}`}
            className="project-archive-gallery-link"
            data-cursor="button"
            onClick={() => onOpenProject(project)}
            type="button"
          >
            <span>Gallery / case study</span>
            <Grid2X2 aria-hidden="true" size={16} />
          </button>
        )}
      </aside>
    </article>
  );
}

export default function ProjectArchive({
  projects,
  startIndex,
  onOpenProject,
  isInteractive,
}: ProjectArchiveProps) {
  return (
    <section aria-label="Project archive" className="project-archive-list">
      {projects.map((project, index) => (
        <ProjectArchiveRow
          index={startIndex + index}
          key={project.id}
          isInteractive={isInteractive(project)}
          onOpenProject={onOpenProject}
          project={project}
        />
      ))}
    </section>
  );
}
