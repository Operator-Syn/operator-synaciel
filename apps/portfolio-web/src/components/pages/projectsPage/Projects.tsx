import { keepPreviousData, useQuery } from "@tanstack/react-query";
import "../../../styles/project-archive.css";
import { type ReactNode, useCallback, useState } from "react";
import { formatArchiveCount } from "../../../data/archiveCount";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";
import { PROJECTS_HEADING, PROJECTS_LEAD } from "../../../data/prerenderRoutes";
import {
  type ApiProject,
  PROJECT_ARCHIVE_PAGE_SIZE,
  toMediaItem,
} from "../../../data/projectArchive";
import { isReducedMotionEnabled } from "../../../preferences/sitePreferences";
import type { MediaItem } from "../../../types/MediaCardTypes";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";
import MediaModal from "../../mediaModal/MediaModal";
import CursorPaginationControls from "../../pagination/CursorPaginationControls";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import { shouldShowArchivePagination } from "../archivePagination";
import useArchiveScrollRestoration from "../useArchiveScrollRestoration";
import ProjectArchive from "./ProjectArchive";

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
const PROJECTS_PER_PAGE = PROJECT_ARCHIVE_PAGE_SIZE;

async function fetchProjectArchive(cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams({ limit: String(PROJECTS_PER_PAGE) });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`${apiUrl}/v2/projects/archive?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Failed to fetch the project archive");

  return (await response.json()) as ProjectArchiveResponse;
}

function scrollToArchiveTop() {
  window.scrollTo({
    top: 0,
    behavior: isReducedMotionEnabled() ? "auto" : "smooth",
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

  useArchiveScrollRestoration("/projects", Boolean(archive));
  const apiProjects = archive?.data.map(toMediaItem) ?? [];
  // The API's own total, and the card count it implies. The header shows the first through
  // `formatArchiveCount`, which adds the future-project slot exactly once; `totalProjectCards` is the card
  // count the archive grid and the pagination label already use, so it must not be incremented again.
  const projectTotal = archive ? archive.pagination.total : null;
  const totalProjectCards = projectTotal === null ? null : projectTotal + 1;
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
  };

  const handleModalExitComplete = useCallback(() => {
    setSelectedProject(null);
  }, []);

  const isInitialLoading = projectsQuery.isPending && !archive;
  const isInitialError = projectsQuery.isError && !archive;
  const isEmpty = Boolean(archive && projects.length === 0);

  return (
    <>
      <GlobalHeadManager url="https://syn-forge.com/projects" />
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
                  <h1 id="projects-page-title">{PROJECTS_HEADING}</h1>
                  <p>{PROJECTS_LEAD}</p>
                </div>
                <p className="meta-label">
                  {totalProjectCards === null ? (
                    <LoadingBlock className="loading-count" />
                  ) : (
                    formatArchiveCount(projectTotal ?? 0, "projects")
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
                {shouldShowArchivePagination(archive.pagination.has_more, currentPage) && (
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
                )}
              </>
            )}

            <MediaModal
              item={selectedProject}
              show={showModal}
              onClose={closeModal}
              onExitComplete={handleModalExitComplete}
              detailsLabel="About this Project"
              ctaLabel="View Project Source"
            />
          </div>
        </CookingArea>
      </main>
    </>
  );
}
