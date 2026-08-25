import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";
import type { MediaItem } from "../../../types/MediaCardTypes";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";
import MediaModal from "../../mediaModal/MediaModal";
import CursorPaginationControls from "../../pagination/CursorPaginationControls";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import ProjectArchive from "./ProjectArchive";

interface ApiGalleryItem {
  id: number;
  project_id: number;
  type: "image" | "video";
  url: string;
  display_order: number;
}

interface ApiProject {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  display_order: number;
  created_at: string;
  gallery: ApiGalleryItem[];
}

interface ProjectArchiveResponse {
  data: ApiProject[];
  pagination: {
    limit: number;
    total: number;
    has_more: boolean;
    next_cursor: string | null;
  };
}

const FUTURE_PROJECTS_CARD: MediaItem = {
  id: 999999,
  title: "Still cooking",
  type: "image",
  url: "https://placehold.co/600x400/E2E8F0/64748B?text=In+Progress",
  shortDescription: "More projects on the way. I'm always working on something new.",
  longDescription: "",
  projectLink: "",
  gallery: [],
};

const apiUrl = import.meta.env.VITE_API_URL;
const PROJECTS_PER_PAGE = 4;

async function fetchProjectArchive(cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams({ limit: String(PROJECTS_PER_PAGE) });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`${apiUrl}/v2/projects/archive?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Failed to fetch the project archive");

  return (await response.json()) as ProjectArchiveResponse;
}

function toMediaItem(project: ApiProject): MediaItem {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    url: project.url,
    shortDescription: project.short_description,
    longDescription: project.long_description,
    projectLink: project.project_link,
    gallery: project.gallery.map((media) => ({
      id: media.id,
      title: project.title,
      type: media.type,
      url: media.url,
      shortDescription: "",
      longDescription: "",
      projectLink: project.project_link,
      gallery: [],
    })),
  };
}

function scrollToArchiveTop() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

function ProjectArchiveState({ children }: { children: ReactNode }) {
  return <div className="project-archive-state">{children}</div>;
}

function ProjectArchiveLoading() {
  return (
    <LoadingRegion
      className="loading-archive-list loading-archive-list-project"
      label="Preparing project archive"
    >
      {["one", "two", "three", "four"].map((key) => (
        <div className="loading-archive-row loading-archive-row-project" key={key}>
          <LoadingBlock className="loading-archive-index" />
          <LoadingBlock className="loading-archive-media" />
          <div className="loading-archive-copy">
            <LoadingBlock className="loading-line-title" />
            <LoadingBlock className="loading-line-copy" />
          </div>
          <div className="loading-archive-actions">
            <LoadingBlock className="loading-line-title" />
            <LoadingBlock className="loading-line-copy-short" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

export default function Projects() {
  const [selectedProject, setSelectedProject] = useState<MediaItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([null]);

  const projectsQuery = useQuery({
    queryKey: ["projects-archive", currentCursor],
    queryFn: ({ signal }) => fetchProjectArchive(currentCursor, signal),
    placeholderData: keepPreviousData,
    staleTime: PUBLIC_DATA_STALE_TIME_MS,
  });

  const archive = projectsQuery.data;
  const apiProjects = archive?.data.map(toMediaItem) ?? [];
  const totalProjectCards = archive ? archive.pagination.total + 1 : null;
  const showFutureProjectCard = Boolean(archive && !archive.pagination.has_more);
  const projects = showFutureProjectCard ? [...apiProjects, FUTURE_PROJECTS_CARD] : apiProjects;

  const handleOpenProject = (project: MediaItem) => {
    if (project.id === FUTURE_PROJECTS_CARD.id) return;
    setSelectedProject(project);
    setShowModal(true);
  };

  const handleNextPage = () => {
    const nextCursor = archive?.pagination.next_cursor;
    if (!nextCursor) return;

    setCursorHistory((history) => {
      const nextHistory = history.slice(0, currentPage);
      nextHistory[currentPage] = nextCursor;
      return nextHistory;
    });
    setCurrentCursor(nextCursor);
    setCurrentPage((page) => page + 1);
    scrollToArchiveTop();
  };

  const handlePreviousPage = () => {
    if (currentPage === 1) return;

    setCurrentCursor(cursorHistory[currentPage - 2] ?? null);
    setCurrentPage((page) => page - 1);
    scrollToArchiveTop();
  };

  const closeModal = () => {
    setShowModal(false);
    window.setTimeout(() => setSelectedProject(null), 300);
  };

  const isInitialLoading = projectsQuery.isPending && !archive;
  const isInitialError = projectsQuery.isError && !archive;
  const isEmpty = Boolean(archive && projects.length === 0);

  return (
    <>
      <GlobalHeadManager
        title="Projects"
        description="Browse software projects by John-Ronan Beira."
        image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
        url="https://syn-forge.com/projects"
      />
      <main aria-labelledby="projects-page-title">
        <CookingArea>
          <div aria-busy={projectsQuery.isFetching} className="project-archive-shell">
            <PointerCoordinates
              activeSection={1}
              className="project-archive-coordinates"
              markerCount={3}
            />

            <header className="project-archive-header">
              <p className="eyebrow">02 / 04</p>
              <div className="project-archive-heading">
                <div>
                  <h1 id="projects-page-title">Selected work / Project archive</h1>
                  <p>A focused collection of light and purposeful projects I've been working on.</p>
                </div>
                <p className="meta-label">
                  {totalProjectCards === null ? (
                    <LoadingBlock className="loading-count" />
                  ) : (
                    `[ ${totalProjectCards} projects ]`
                  )}
                </p>
              </div>
            </header>

            {isInitialLoading && <ProjectArchiveLoading />}

            {isInitialError && (
              <ProjectArchiveState>
                <p className="project-archive-error" role="alert">
                  Unable to load projects.
                </p>
                <button
                  className="action-quiet"
                  onClick={() => projectsQuery.refetch()}
                  type="button"
                >
                  Try again
                </button>
              </ProjectArchiveState>
            )}

            {!isInitialLoading && !isInitialError && isEmpty && (
              <ProjectArchiveState>
                <p className="eyebrow">Archive empty</p>
                <p>No projects are available yet.</p>
              </ProjectArchiveState>
            )}

            {archive && !isEmpty && (
              <>
                {projectsQuery.isError && (
                  <div className="project-archive-inline-error" role="alert">
                    <span>That archive page could not be refreshed.</span>
                    <button onClick={() => projectsQuery.refetch()} type="button">
                      Retry
                    </button>
                  </div>
                )}
                <ProjectArchive
                  isInteractive={(project) => project.id !== FUTURE_PROJECTS_CARD.id}
                  onOpenProject={handleOpenProject}
                  projects={projects}
                  startIndex={(currentPage - 1) * PROJECTS_PER_PAGE}
                />
                <CursorPaginationControls
                  currentPage={currentPage}
                  hasNextPage={archive.pagination.has_more}
                  isFetching={projectsQuery.isFetching}
                  itemLabel="projects"
                  onNextPage={handleNextPage}
                  onPreviousPage={handlePreviousPage}
                  pageSize={PROJECTS_PER_PAGE}
                  totalItems={totalProjectCards ?? 0}
                  visibleItemCount={projects.length}
                />
              </>
            )}

            <MediaModal
              item={selectedProject}
              show={showModal}
              onClose={closeModal}
              detailsLabel="About this Project"
              ctaLabel="View Project Source"
            />
          </div>
        </CookingArea>
      </main>
    </>
  );
}
