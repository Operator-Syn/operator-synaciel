import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";
import type { MediaItem } from "../../../types/MediaCardTypes";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import Grid from "../../grid/Grid";
import MediaModal from "../../mediaModal/MediaModal";
import PaginationControls from "../../pagination/PaginationControls";

interface ApiCertification {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string;
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
      projectLink: cert.certificate_link,
      gallery:
        itemQueries[index]?.data
          ?.sort((a, b) => a.display_order - b.display_order)
          .map((media) => ({
            id: media.id,
            title: "",
            type: media.type,
            url: media.url,
            shortDescription: "",
            longDescription: "",
            projectLink: "",
            gallery: [],
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
      <CookingArea>
        <div className="py-10 sm:py-14">
          <header className="mb-8 border-b border-line pb-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow mb-5">03 / 04</p>
                <h1 className="text-page-title text-text">Credentials / learning archive</h1>
                <p className="mt-4 max-w-2xl text-lg text-text-muted">
                  Training completed through workshops, programs, and certifications.
                </p>
              </div>
              <p className="meta-label">[ {certifications.length} certifications ]</p>
            </div>
          </header>

          {certsQuery.isLoading && (
            <div className="grid min-h-72 place-items-center border-y border-line">
              <p className="eyebrow animate-pulse">Loading credentials</p>
            </div>
          )}
          {certsQuery.isError && (
            <div className="border-y border-danger py-8 text-danger">
              Unable to load certificates.
            </div>
          )}
          {!certsQuery.isLoading && !certsQuery.isError && (
            <>
              <Grid projects={displayCerts} onProjectClick={handleOpenCert} />
              <PaginationControls
                currentPage={currentPage}
                itemLabel="certifications"
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 0, behavior: "smooth" });
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
    </>
  );
}
