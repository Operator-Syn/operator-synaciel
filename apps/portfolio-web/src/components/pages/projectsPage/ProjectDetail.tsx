/**
 * A project's detail page: `/projects/<id>/<slug>`.
 *
 * The page is client-rendered like the rest of the app, while the crawler-visible body is the
 * build-time fragment the middleware injects. Two rules follow from that:
 *
 * - The head is written only once the project has resolved. The route map cannot describe a project,
 *   so rendering the head manager during loading would overwrite the server's per-project title with
 *   the archive's.
 * - A stale slug, or a bare id, is replaced in place with the canonical URL, so one project has one
 *   address even before the server's redirect runs.
 */

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";
import {
  type ApiProject,
  findProjectById,
  type ProjectPageResult,
  projectArchiveUrl,
  readProjectPageBody,
} from "../../../data/projectArchive";
import { projectPageDescription, projectPath, safeExternalHref } from "../../../data/projectRoutes";
import "../../../styles/project-detail.css";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";
import MediaRenderer from "../../mediaRenderer/MediaRenderer";
import TransitionLink from "../../pageTransition/TransitionLink";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import { parseProjectDescription } from "./projectDescription";

const apiUrl = import.meta.env.VITE_API_URL;

/** The archive page this browser reads; no cache, because the walk decides existence from it. */
async function fetchArchivePage(cursor: string | null): Promise<ProjectPageResult> {
  try {
    const response = await fetch(projectArchiveUrl(apiUrl, cursor), { cache: "no-store" });
    if (!response.ok) return { ok: false, reason: `http ${response.status}` };

    const page = readProjectPageBody(await response.text());
    if (!page) return { ok: false, reason: "malformed body" };

    return { ok: true, ...page, fromCache: false };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** What the browser managed to learn about the requested project. */
type ProjectResult =
  | { readonly status: "found"; readonly project: ApiProject }
  | { readonly status: "missing" }
  | { readonly status: "unavailable" };

/**
 * Resolve one project in the browser.
 *
 * The two negative states are kept apart because they mean different things and deserve different
 * copy: `missing` is a complete read that does not contain the project, `unavailable` is a read that
 * could not be completed. Neither becomes a NotFound — the server owns the 404 — but a reader is told
 * which one happened.
 *
 * @param id The project id from the URL.
 * @returns The project, or which negative state applies.
 */
async function fetchProject(id: number): Promise<ProjectResult> {
  const lookup = await findProjectById(fetchArchivePage, id);
  if (lookup.status === "found") return { status: "found", project: lookup.project };
  if (lookup.status === "missing") return { status: "missing" };
  return { status: "unavailable" };
}

function DetailCover({ project }: { project: ApiProject }) {
  return (
    <figure className="project-detail-media">
      <MediaRenderer
        alt={`${project.title} cover image`}
        className="project-detail-media-content"
        image={{ transformWidth: 1360, width: 1200, height: 675, loading: "eager" }}
        type={project.type}
        url={project.url}
      />
    </figure>
  );
}

function FacetList({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label={label} className="project-detail-facet">
      <h2>{label}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function DetailLoading() {
  return (
    <LoadingRegion className="project-detail-loading" label="Preparing project">
      <LoadingBlock className="project-detail-loading-eyebrow" />
      <LoadingBlock className="project-detail-loading-title" />
      <LoadingBlock className="project-detail-loading-line" />
      <LoadingBlock className="project-detail-loading-media" />
    </LoadingRegion>
  );
}

export default function ProjectDetail() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const numericId = Number(idParam);
  const hasValidId = Number.isSafeInteger(numericId) && numericId > 0;

  const projectQuery = useQuery({
    queryKey: ["project-detail", numericId],
    queryFn: () => fetchProject(numericId),
    enabled: hasValidId,
    staleTime: PUBLIC_DATA_STALE_TIME_MS,
  });

  const result = projectQuery.data;
  const project = result?.status === "found" ? result.project : null;
  const canonicalPath = project ? projectPath(project.id, project.title) : null;

  // A bare id or a stale slug becomes the canonical URL without a server round trip.
  useEffect(() => {
    if (!canonicalPath || window.location.pathname === canonicalPath) return;
    navigate(canonicalPath, { replace: true });
  }, [canonicalPath, navigate]);

  const blocks = useMemo(
    () => (project ? parseProjectDescription(project.long_description) : []),
    [project],
  );
  const projectHref = project ? safeExternalHref(project.project_link) : undefined;

  const isLoading = hasValidId && projectQuery.isLoading;
  const isUnavailable = !hasValidId || projectQuery.isError || result?.status !== "found";

  return (
    <>
      {/* Rendered only with the project in hand: before that, the server's head is the correct one. */}
      {project && canonicalPath ? (
        <GlobalHeadManager
          description={projectPageDescription(project)}
          imageAlt={`${project.title} — Syn-Forge social preview`}
          title={project.title}
          url={`https://syn-forge.com${canonicalPath}`}
        />
      ) : null}

      <CookingArea>
        <main aria-labelledby="project-detail-title" className="project-detail-page">
          <div className="project-detail-shell">
            <PointerCoordinates
              activeSection={1}
              className="project-detail-coordinates"
              markerCount={1}
            />

            {isLoading ? <DetailLoading /> : null}

            {!isLoading && isUnavailable ? (
              <div className="project-detail-state" role="alert">
                <h1 id="project-detail-title">Project unavailable</h1>
                <p>
                  {result?.status === "missing"
                    ? "This project is no longer in the archive."
                    : "This project could not be loaded. The archive is the best place to try again."}
                </p>
                <TransitionLink className="action-quiet" to="/projects">
                  <ArrowLeft aria-hidden="true" size={17} />
                  Back to projects
                </TransitionLink>
              </div>
            ) : null}

            {!isLoading && project && canonicalPath ? (
              <>
                <header className="project-detail-header">
                  <p className="eyebrow">Case study</p>
                  <div className="project-detail-heading">
                    <div>
                      <h1 id="project-detail-title">{project.title}</h1>
                      <p className="project-detail-summary">{project.short_description}</p>
                    </div>
                    <p className="meta-label">
                      {project.categories.length > 0
                        ? project.categories.join(" / ")
                        : project.type}
                    </p>
                  </div>
                  <div className="project-detail-actions">
                    <TransitionLink className="action-quiet" to="/projects">
                      <ArrowLeft aria-hidden="true" size={17} />
                      Back to archive
                    </TransitionLink>
                    {projectHref ? (
                      <a
                        className="action-signal"
                        href={projectHref}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Visit project
                        <ArrowUpRight aria-hidden="true" size={16} />
                      </a>
                    ) : null}
                  </div>
                </header>

                <DetailCover project={project} />

                <div className="project-detail-facets">
                  <FacetList items={project.stack} label="Stack" />
                  <FacetList items={project.highlights} label="Highlights" />
                </div>

                {blocks.length > 0 ? (
                  <section aria-label="About this project" className="project-detail-description">
                    {blocks.map((block) =>
                      block.kind === "paragraph" ? (
                        <p key={block.id}>{block.text}</p>
                      ) : (
                        <ul key={block.id}>
                          {block.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ),
                    )}
                  </section>
                ) : null}

                {project.gallery.length > 0 ? (
                  <section aria-label="Project gallery" className="project-detail-gallery">
                    {project.gallery.map((media, index) => (
                      <figure key={`${media.url}-${index}`} className="project-detail-gallery-item">
                        <MediaRenderer
                          alt={`${project.title} gallery image ${index + 1}`}
                          className="project-detail-media-content"
                          image={{ transformWidth: 768, width: 640, height: 360, loading: "lazy" }}
                          type={media.type}
                          url={media.url}
                        />
                      </figure>
                    ))}
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </main>
      </CookingArea>
    </>
  );
}
