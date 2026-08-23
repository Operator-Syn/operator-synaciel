import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { HomeProject } from "../../types/HomePageTypes";

interface HomeSelectedWorkProps {
  isError: boolean;
  isLoading: boolean;
  projects: HomeProject[];
}

function projectTypeLabel(type: HomeProject["type"]) {
  return type === "video" ? "Motion study" : "Image archive";
}

export default function HomeSelectedWork({ isError, isLoading, projects }: HomeSelectedWorkProps) {
  const selectedProjects = projects.slice(0, 3);

  return (
    <section
      className="homepage-work"
      data-home-section-index="1"
      aria-labelledby="homepage-work-title"
    >
      <div className="homepage-section-heading">
        <p className="homepage-section-index">
          02 <span>/ 04</span>
        </p>
        <p className="eyebrow" id="homepage-work-title">
          Selected work
        </p>
        <Link className="homepage-section-link" to="/projects">
          View all projects
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>

      {isLoading ? (
        <div className="homepage-work-grid" aria-hidden="true">
          {["first", "second", "third"].map((key) => (
            <div className="homepage-work-card is-loading" key={key} />
          ))}
        </div>
      ) : isError ? (
        <p className="homepage-inline-state homepage-work-state">
          Selected work is temporarily unavailable.
        </p>
      ) : selectedProjects.length > 0 ? (
        <div className="homepage-work-grid">
          {selectedProjects.map((project, index) => (
            <article className="homepage-work-card" key={project.id}>
              <p className="homepage-work-number">{String(index + 1).padStart(2, "0")}</p>
              <div className="homepage-work-content">
                <p className="meta-label">{projectTypeLabel(project.type)}</p>
                <h2>{project.title}</h2>
                <p className="homepage-work-description">{project.short_description}</p>
                <div className="homepage-work-meta">
                  <span>{project.type}</span>
                  <a
                    aria-label={`Open ${project.title}`}
                    data-cursor="alias"
                    href={project.project_link}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ArrowUpRight aria-hidden="true" size={18} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="homepage-inline-state homepage-work-state">
          No selected work is available yet.
        </p>
      )}
    </section>
  );
}
