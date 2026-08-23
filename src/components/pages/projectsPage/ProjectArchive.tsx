import { ArrowRight, Grid2X2 } from "lucide-react";
import type { MediaItem } from "../../../types/MediaCardTypes";
import MediaRenderer from "../../mediaRenderer/MediaRenderer";

interface ProjectArchiveProps {
  projects: MediaItem[];
  startIndex: number;
  onOpenProject: (project: MediaItem) => void;
}

function ProjectMedia({
  project,
  onOpenProject,
}: {
  project: MediaItem;
  onOpenProject: (project: MediaItem) => void;
}) {
  const mediaLabel = `${project.title} preview`;
  const media = (
    <MediaRenderer
      alt={mediaLabel}
      type={project.type}
      url={project.url}
      className="project-archive-media-content"
    />
  );

  if (project.type === "video") {
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
}: {
  project: MediaItem;
  index: number;
  onOpenProject: (project: MediaItem) => void;
}) {
  const projectNumber = String(index + 1).padStart(2, "0");
  const titleId = `project-archive-title-${project.id}`;

  return (
    <article aria-labelledby={titleId} className="project-archive-row">
      <div className="project-archive-index-wrap">
        <p className="project-archive-index">{projectNumber}</p>
        <span className="meta-label project-archive-mobile-type">{project.type}</span>
      </div>

      <ProjectMedia project={project} onOpenProject={onOpenProject} />

      <div className="project-archive-copy" data-cursor="cell">
        <h2 id={titleId}>{project.title}</h2>
        <p>{project.shortDescription}</p>
      </div>

      <aside className="project-archive-actions">
        <p className="meta-label project-archive-desktop-type">{project.type}</p>

        {project.projectLink ? (
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
      </aside>
    </article>
  );
}

export default function ProjectArchive({
  projects,
  startIndex,
  onOpenProject,
}: ProjectArchiveProps) {
  return (
    <section aria-label="Project archive" className="project-archive-list">
      {projects.map((project, index) => (
        <ProjectArchiveRow
          index={startIndex + index}
          key={project.id}
          onOpenProject={onOpenProject}
          project={project}
        />
      ))}
    </section>
  );
}
