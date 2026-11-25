import { ArrowRight, Grid2X2 } from "lucide-react";
import { projectPath } from "../../../data/projectRoutes";
import type { MediaItem } from "../../../types/MediaCardTypes";
import MediaRenderer from "../../mediaRenderer/MediaRenderer";
import TransitionLink from "../../pageTransition/TransitionLink";

/**
 * Project media is served from the R2 bucket through Cloudflare's image transform.
 * The widest box the layout produces is 676 px, at a 800 px viewport while the row is
 * still single-column; one pixel wider it drops to a ~248 px column. 1360 covers that
 * widest case at DPR2, and the display ratio is 2.7 in every state — which is what the
 * element attributes describe, not the source file's own proportions.
 */
const PROJECT_IMAGE_TRANSFORM_WIDTH = 1360;
const PROJECT_IMAGE_WIDTH = 540;
const PROJECT_IMAGE_HEIGHT = 200;

interface ProjectArchiveProps {
  projects: MediaItem[];
  startIndex: number;
  onOpenProject: (project: MediaItem) => void;
  isInteractive: (project: MediaItem) => boolean;
}

function ProjectMedia({
  project,
  position,
  onOpenProject,
  isInteractive,
}: {
  project: MediaItem;
  /** Index within the rendered page, so the first two cards are eager. */
  position: number;
  onOpenProject: (project: MediaItem) => void;
  isInteractive: boolean;
}) {
  const mediaLabel = `${project.title} preview`;
  const media = (
    <MediaRenderer
      alt={mediaLabel}
      className="project-archive-media-content"
      cursorState={project.type === "image" && isInteractive ? "zoom-in" : undefined}
      image={{
        transformWidth: PROJECT_IMAGE_TRANSFORM_WIDTH,
        width: PROJECT_IMAGE_WIDTH,
        height: PROJECT_IMAGE_HEIGHT,
        loading: position < 2 ? "eager" : "lazy",
      }}
      type={project.type}
      url={project.url}
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
  pageIndex,
  onOpenProject,
  isInteractive,
}: {
  project: MediaItem;
  index: number;
  /** Position within the rendered page, which drives the eager/lazy hint. */
  pageIndex: number;
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

      <ProjectMedia
        isInteractive={isInteractive}
        onOpenProject={onOpenProject}
        position={pageIndex}
        project={project}
      />

      <div className="project-archive-copy">
        <h2 id={titleId}>
          {isInteractive ? (
            <TransitionLink to={projectPath(project.id, project.title)}>
              {project.title}
            </TransitionLink>
          ) : (
            project.title
          )}
        </h2>
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
          pageIndex={index}
          key={project.id}
          isInteractive={isInteractive(project)}
          onOpenProject={onOpenProject}
          project={project}
        />
      ))}
    </section>
  );
}
