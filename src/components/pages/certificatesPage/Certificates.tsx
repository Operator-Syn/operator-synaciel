// src/components/pages/certificationsPage/Certifications.tsx
import { useState, useMemo, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import CookingArea from "../../cookingArea/CookingArea";
import './Certificates.css';
import { type MediaItem } from '../../../types/MediaCardTypes';
import Grid from '../../grid/Grid';
import MediaModal from '../../mediaModal/MediaModal';
import GlobalHeadManager from '../../globalHeadManager/GlobalHeadManager';
import { PUBLIC_DATA_STALE_TIME_MS } from '../../../data/cacheSettings';
import PaginationControls from '../../pagination/PaginationControls';

interface ApiCertification {
    id: number;
    title: string;
    type: 'video' | 'image';
    url: string;
    short_description: string;
    long_description: string;
    certificate_link: string;
    display_order: number;
}

interface ApiCertificateItem {
    id: number;
    certificate_id: number;
    type: 'image' | 'video';
    url: string;
    display_order: number;
}

const FUTURE_CERT_CARD: MediaItem = {
    id: 888888,
    title: "Still cooking",
    type: 'image',
    url: 'https://placehold.co/600x400/E2E8F0/64748B?text=In+Progress',
    shortDescription: "More certifications on the way. I'm always learning something new.",
    longDescription: "",
    projectLink: "",
    gallery: [],
};

const apiUrl = import.meta.env.VITE_API_URL;
const CERTIFICATES_PER_PAGE = 6;

// --- fetch functions ---
const fetchCertifications = async (): Promise<ApiCertification[]> => {
    const res = await fetch(`${apiUrl}/certificates`);
    if (!res.ok) throw new Error('Failed to fetch certifications');
    return res.json();
};

const fetchCertificateItems = async (certId: number): Promise<ApiCertificateItem[]> => {
    const res = await fetch(`${apiUrl}/certificates/${certId}/items`);
    if (!res.ok) return [];
    return res.json();
};

// --- main component ---
export default function Certifications() {
    const [selectedCert, setSelectedCert] = useState<MediaItem | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // --- dynamic header logic ---
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const HeaderTag = isMobile ? 'h3' : 'h1';

    // --- fetch certificates ---
    const certsQuery = useQueries({
        queries: [
            {
                queryKey: ['certificates'],
                queryFn: fetchCertifications,
                staleTime: PUBLIC_DATA_STALE_TIME_MS,
            },
        ],
    })[0];

    const certifications: ApiCertification[] = useMemo(
        () => [...(certsQuery.data ?? [])].sort((a, b) => a.display_order - b.display_order),
        [certsQuery.data],
    );
    const isLoading = certsQuery.isLoading;
    const isError = certsQuery.isError;
    const totalCertificateCards = certifications.length + 1;
    const totalPages = Math.max(Math.ceil(totalCertificateCards / CERTIFICATES_PER_PAGE), 1);
    const pageStartIndex = (currentPage - 1) * CERTIFICATES_PER_PAGE;
    const pageCertifications = useMemo(
        () => certifications.slice(pageStartIndex, pageStartIndex + CERTIFICATES_PER_PAGE),
        [certifications, pageStartIndex],
    );
    const showFutureCertCard = pageStartIndex + pageCertifications.length < totalCertificateCards
        && pageStartIndex + CERTIFICATES_PER_PAGE >= totalCertificateCards;

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    // --- fetch items for all certificates in parallel ---
    const itemQueries = useQueries({
        queries: pageCertifications.map(cert => ({
            queryKey: ['certificate-items', cert.id],
            queryFn: () => fetchCertificateItems(cert.id),
            staleTime: PUBLIC_DATA_STALE_TIME_MS,
            enabled: !!pageCertifications.length,
        })),
    });

    // --- transform into MediaItem shape ---
    const displayCerts: MediaItem[] = useMemo(() => {
        const mapped = pageCertifications
            .map((c, i) => ({
                id: c.id,
                title: c.title,
                type: c.type,
                url: c.url,
                shortDescription: c.short_description,
                longDescription: c.long_description,
                projectLink: c.certificate_link,
                gallery: itemQueries[i]?.data?.sort((a, b) => a.display_order - b.display_order).map(item => ({
                    id: item.id,
                    title: '',
                    type: item.type,
                    url: item.url,
                    shortDescription: '',
                    longDescription: '',
                    projectLink: '',
                    gallery: [],
                })) ?? [],
            }));

        return showFutureCertCard ? [...mapped, FUTURE_CERT_CARD] : mapped;
    }, [itemQueries, pageCertifications, showFutureCertCard]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleOpenCert = (cert: MediaItem) => {
        if (cert.id === FUTURE_CERT_CARD.id) return;
        setSelectedCert(cert);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setTimeout(() => setSelectedCert(null), 300);
    };

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: "https://syn-forge.com/",
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Certificates",
                item: "https://syn-forge.com/certificates",
            },
        ],
    };

    return (
        <>
            <GlobalHeadManager
                title="Certificates"
                description="A showcase of completed certificates, training, and credential details across software development, cloud technologies, and related disciplines."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/certificates"
                jsonLd={breadcrumbSchema}
            />
            <CookingArea>
                <div className="container py-3">
                    <HeaderTag className="mb-4">
                        Credentials and specialized training I've completed.
                    </HeaderTag>

                    {isLoading && (
                        <div className="d-flex justify-content-center my-5">
                            <div className="spinner-border text-primary" role="status"></div>
                        </div>
                    )}

                    {!isLoading && !isError && (
                        <>
                            <Grid projects={displayCerts} onProjectClick={handleOpenCert} />
                            <PaginationControls
                                currentPage={currentPage}
                                itemLabel="certifications"
                                onPageChange={handlePageChange}
                                pageSize={CERTIFICATES_PER_PAGE}
                                totalItems={totalCertificateCards}
                                totalPages={totalPages}
                            />
                        </>
                    )}

                    <MediaModal
                        item={selectedCert}
                        show={showModal}
                        onClose={handleCloseModal}
                        detailsLabel="Certification Details"
                        ctaLabel="View Credential"
                    />
                </div>
            </CookingArea>
        </>
    );
}
