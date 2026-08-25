import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";
import type { MediaItem } from "../../../types/MediaCardTypes";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import MediaModal from "../../mediaModal/MediaModal";
import PaginationControls from "../../pagination/PaginationControls";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import CertificateArchive from "./CertificateArchive";

interface ApiCertification {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string | null;
  display_order: number;
}

interface ApiCertificateItem {
  id: number;
  certificate_id: number;
  type: "image" | "video";
  url: string;
  display_order: number;
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

const fetchCertifications = async (): Promise<ApiCertification[]> => {
  const res = await fetch(`${apiUrl}/certificates`);
  if (!res.ok) throw new Error("Failed to fetch certifications");
  return res.json();
};

const fetchCertificateItems = async (certId: number): Promise<ApiCertificateItem[]> => {
  const res = await fetch(`${apiUrl}/certificates/${certId}/items`);
  if (!res.ok) return [];
  return res.json();
};

export default function Certifications() {
  const [selectedCert, setSelectedCert] = useState<MediaItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const certsQuery = useQueries({
    queries: [
      {
        queryKey: ["certificates"],
        queryFn: fetchCertifications,
        staleTime: PUBLIC_DATA_STALE_TIME_MS,
      },
    ],
  })[0];

  const certifications = useMemo(
    () => [...(certsQuery.data ?? [])].sort((a, b) => a.display_order - b.display_order),
    [certsQuery.data],
  );
  const totalCertificateCards = certifications.length + 1;
  const totalPages = Math.max(Math.ceil(totalCertificateCards / CERTIFICATES_PER_PAGE), 1);
  const pageStartIndex = (currentPage - 1) * CERTIFICATES_PER_PAGE;
  const pageCertifications = useMemo(
    () => certifications.slice(pageStartIndex, pageStartIndex + CERTIFICATES_PER_PAGE),
    [certifications, pageStartIndex],
  );
  const showFutureCertCard =
    pageStartIndex + pageCertifications.length < totalCertificateCards &&
    pageStartIndex + CERTIFICATES_PER_PAGE >= totalCertificateCards;

  useEffect(() => setCurrentPage((page) => Math.min(page, totalPages)), [totalPages]);

  const itemQueries = useQueries({
    queries: pageCertifications.map((cert) => ({
      queryKey: ["certificate-items", cert.id],
      queryFn: () => fetchCertificateItems(cert.id),
      staleTime: PUBLIC_DATA_STALE_TIME_MS,
      enabled: pageCertifications.length > 0,
    })),
  });

  const displayCerts: MediaItem[] = useMemo(() => {
    const mapped = pageCertifications.map((cert, index) => ({
      id: cert.id,
      title: cert.title,
      type: cert.type,
      url: cert.url,
      shortDescription: cert.short_description,
      longDescription: cert.long_description,
      projectLink: cert.certificate_link ?? "",
      gallery:
        itemQueries[index]?.data
          ?.slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((media) => ({
            type: media.type,
            url: media.url,
          })) ?? [],
    }));

    return showFutureCertCard ? [...mapped, FUTURE_CERT_CARD] : mapped;
  }, [itemQueries, pageCertifications, showFutureCertCard]);

  const handleOpenCert = (cert: MediaItem) => {
    if (cert.id === FUTURE_CERT_CARD.id) return;
    setSelectedCert(cert);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    window.setTimeout(() => setSelectedCert(null), 300);
  };

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
          <div className="certificate-archive-shell">
            <PointerCoordinates
              activeSection={1}
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
                <p className="meta-label">[ {totalCertificateCards} certifications ]</p>
              </div>
            </header>

            {certsQuery.isLoading && (
              <div className="certificate-archive-state">
                <p className="eyebrow" aria-live="polite">
                  Loading credentials
                </p>
              </div>
            )}
            {certsQuery.isError && (
              <div className="certificate-archive-state certificate-archive-error" role="alert">
                <p>Unable to load certificates.</p>
                <button className="action-quiet" onClick={() => certsQuery.refetch()} type="button">
                  Try again
                </button>
              </div>
            )}
            {!certsQuery.isLoading && !certsQuery.isError && displayCerts.length === 0 && (
              <div className="certificate-archive-state">
                <p>No credentials are available yet.</p>
              </div>
            )}
            {!certsQuery.isLoading && !certsQuery.isError && displayCerts.length > 0 && (
              <>
                <CertificateArchive
                  certificates={displayCerts}
                  isInteractive={(certificate) => certificate.id !== FUTURE_CERT_CARD.id}
                  onOpenCertificate={handleOpenCert}
                  startIndex={pageStartIndex}
                />
                <PaginationControls
                  currentPage={currentPage}
                  itemLabel="certifications"
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    window.scrollTo({
                      top: 0,
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                    });
                  }}
                  pageSize={CERTIFICATES_PER_PAGE}
                  totalItems={totalCertificateCards}
                  totalPages={totalPages}
                />
              </>
            )}

            <MediaModal
              item={selectedCert}
              show={showModal}
              onClose={closeModal}
              detailsLabel="Certification Details"
              ctaLabel="View Credential"
            />
          </div>
        </CookingArea>
      </main>
    </>
  );
}
