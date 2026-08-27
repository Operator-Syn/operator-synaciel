import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ReactNode, useCallback, useState } from "react";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";
import { isReducedMotionEnabled } from "../../../preferences/sitePreferences";
import type { MediaItem } from "../../../types/MediaCardTypes";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";
import MediaModal from "../../mediaModal/MediaModal";
import CursorPaginationControls from "../../pagination/CursorPaginationControls";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import CertificateArchive from "./CertificateArchive";

interface ApiCertificateItem {
  id: number;
  certificate_id: number;
  type: "image" | "video";
  url: string;
  display_order: number;
}

interface ApiCertification {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string | null;
  display_order: number;
  created_at: string;
  items: ApiCertificateItem[];
}

interface CertificateArchiveResponse {
  data: ApiCertification[];
  pagination: {
    limit: number;
    total: number;
    has_more: boolean;
    next_cursor: string | null;
  };
}

const FUTURE_CERT_CARD: MediaItem = {
  id: 888888,
  title: "Still cooking",
  type: "image",
  url: "https://placehold.co/600x400/E2E8F0/64748B?text=In+Progress",
  shortDescription: "More certifications on the way. I'm always learning something new.",
  longDescription: "",
  projectLink: "",
  gallery: [],
};

const apiUrl = import.meta.env.VITE_API_URL;
const CERTIFICATES_PER_PAGE = 6;

async function fetchCertificateArchive(cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams({ limit: String(CERTIFICATES_PER_PAGE) });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`${apiUrl}/v2/certificates/archive?${params.toString()}`, {
    signal,
  });
  if (!response.ok) throw new Error("Failed to fetch the certificate archive");

  return (await response.json()) as CertificateArchiveResponse;
}

function toMediaItem(certificate: ApiCertification): MediaItem {
  return {
    id: certificate.id,
    title: certificate.title,
    type: certificate.type,
    url: certificate.url,
    shortDescription: certificate.short_description,
    longDescription: certificate.long_description,
    projectLink: certificate.certificate_link ?? "",
    gallery: certificate.items.map((item) => ({
      type: item.type,
      url: item.url,
    })),
  };
}

function scrollToArchiveTop() {
  window.scrollTo({
    top: 0,
    behavior: isReducedMotionEnabled() ? "auto" : "smooth",
  });
}

function CertificateArchiveState({ children }: { children: ReactNode }) {
  return <div className="certificate-archive-state">{children}</div>;
}

function CertificateArchiveLoading() {
  return (
    <LoadingRegion
      className="certificate-archive-grid certificate-archive-loading"
      data-card-count="6"
      label="Preparing certificate archive"
    >
      {["one", "two", "three", "four", "five", "six"].map((key) => (
        <article className="certificate-archive-card certificate-archive-card-loading" key={key}>
          <div className="certificate-archive-index-wrap">
            <LoadingBlock className="certificate-archive-loading-index" />
          </div>

          <LoadingBlock className="certificate-archive-media certificate-archive-loading-media" />

          <div className="certificate-archive-copy">
            <LoadingBlock className="certificate-archive-loading-type" />
            <LoadingBlock className="certificate-archive-loading-title" />
            <LoadingBlock className="certificate-archive-loading-description" />

            <div className="certificate-archive-actions">
              <LoadingBlock className="certificate-archive-loading-action" />
            </div>
          </div>
        </article>
      ))}
    </LoadingRegion>
  );
}

export default function Certifications() {
  const [selectedCert, setSelectedCert] = useState<MediaItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([null]);

  const certsQuery = useQuery({
    queryKey: ["certificates-archive", currentCursor],
    queryFn: ({ signal }) => fetchCertificateArchive(currentCursor, signal),
    placeholderData: keepPreviousData,
    staleTime: PUBLIC_DATA_STALE_TIME_MS,
  });

  const archive = certsQuery.data;
  const apiCertifications = archive?.data.map(toMediaItem) ?? [];
  const totalCertificateCards = archive ? archive.pagination.total + 1 : null;
  const showFutureCertCard = Boolean(archive && !archive.pagination.has_more);
  const displayCerts = showFutureCertCard
    ? [...apiCertifications, FUTURE_CERT_CARD]
    : apiCertifications;

  const handleOpenCert = (certificate: MediaItem) => {
    if (certificate.id === FUTURE_CERT_CARD.id) return;
    setSelectedCert(certificate);
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
    setSelectedCert(null);
  }, []);

  const isInitialLoading = certsQuery.isPending && !archive;
  const isInitialError = certsQuery.isError && !archive;
  const isEmpty = Boolean(archive && displayCerts.length === 0);

  return (
    <>
      <GlobalHeadManager
        title="Training and Credentials"
        description="Explore certificates and training credentials covering software development and related learning."
        image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
        url="https://syn-forge.com/certificates"
      />
      <main aria-labelledby="certificates-page-title">
        <CookingArea>
          <div aria-busy={certsQuery.isFetching} className="certificate-archive-shell">
            <PointerCoordinates
              activeSection={2}
              className="certificate-archive-coordinates"
              markerCount={3}
            />

            <header className="certificate-archive-header">
              <p className="eyebrow">03 / 04</p>
              <div className="certificate-archive-heading">
                <div>
                  <h1 id="certificates-page-title">Credentials / learning archive</h1>
                  <p>
                    Training completed through workshops, programs, and certifications that support
                    continuous learning and professional growth.
                  </p>
                </div>
                <p className="meta-label">
                  {totalCertificateCards === null ? (
                    <LoadingBlock className="loading-count" />
                  ) : (
                    `[ ${totalCertificateCards} certifications ]`
                  )}
                </p>
              </div>
            </header>

            {isInitialLoading && <CertificateArchiveLoading />}

            {isInitialError && (
              <CertificateArchiveState>
                <p className="certificate-archive-error" role="alert">
                  Unable to load certificates.
                </p>
                <button className="action-quiet" onClick={() => certsQuery.refetch()} type="button">
                  Try again
                </button>
              </CertificateArchiveState>
            )}

            {!isInitialLoading && !isInitialError && isEmpty && (
              <CertificateArchiveState>
                <p className="eyebrow">Archive empty</p>
                <p>No credentials are available yet.</p>
              </CertificateArchiveState>
            )}

            {archive && !isEmpty && (
              <>
                {certsQuery.isError && (
                  <div className="certificate-archive-inline-error" role="alert">
                    <span>That archive page could not be refreshed.</span>
                    <button onClick={() => certsQuery.refetch()} type="button">
                      Retry
                    </button>
                  </div>
                )}
                <CertificateArchive
                  certificates={displayCerts}
                  isInteractive={(certificate) => certificate.id !== FUTURE_CERT_CARD.id}
                  onOpenCertificate={handleOpenCert}
                  startIndex={(currentPage - 1) * CERTIFICATES_PER_PAGE}
                />
                <CursorPaginationControls
                  currentPage={currentPage}
                  hasNextPage={archive.pagination.has_more}
                  isFetching={certsQuery.isFetching}
                  itemLabel="certifications"
                  onNextPage={handleNextPage}
                  onPreviousPage={handlePreviousPage}
                  pageSize={CERTIFICATES_PER_PAGE}
                  totalItems={totalCertificateCards ?? 0}
                  variant="certificate"
                  visibleItemCount={displayCerts.length}
                />
              </>
            )}

            <MediaModal
              item={selectedCert}
              show={showModal}
              onClose={closeModal}
              onExitComplete={handleModalExitComplete}
              detailsLabel="Certification Details"
              ctaLabel="View Credential"
            />
          </div>
        </CookingArea>
      </main>
    </>
  );
}
