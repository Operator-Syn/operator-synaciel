// src/components/pages/projectsPage/Projects.tsx
import { useState, useMemo, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import CookingArea from "../../cookingArea/CookingArea";
import './Projects.css';
import { type MediaItem } from '../../../types/MediaCardTypes';
import Grid from '../../grid/Grid';
import MediaModal from '../../mediaModal/MediaModal';
import GlobalHeadManager from '../../globalHeadManager/GlobalHeadManager';
import { PUBLIC_DATA_STALE_TIME_MS } from '../../../data/cacheSettings';
import PaginationControls from '../../pagination/PaginationControls';

// --- UPDATED INTERFACE: Matches ProjectsModel.ts flat structure ---
interface ApiProject {
    id: number;
    title: string;
    type: 'video' | 'image';
    url: string;
    short_description: string;
    long_description: string;
    project_link: string;
    display_order: number;
}

interface ApiGalleryItem {
    id: number;
    project_id: number;
    type: 'image' | 'video';
    url: string;
    display_order: number;
}

const FUTURE_PROJECTS_CARD: MediaItem = {
    id: 999999,
    title: "Still cooking",
    type: 'image',
    url: 'https://placehold.co/600x400/E2E8F0/64748B?text=In+Progress',
    shortDescription: "More projects on the way. I'm always working on something new.",
    longDescription: "",
    projectLink: "",
    gallery: [],
};

const apiUrl = import.meta.env.VITE_API_URL;
const PROJECTS_PER_PAGE = 6;

// --- fetch functions ---
const fetchProjects = async (): Promise<ApiProject[]> => {
    const res = await fetch(`${apiUrl}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
};

const fetchGalleryByProject = async (projectId: number): Promise<ApiGalleryItem[]> => {
    const res = await fetch(`${apiUrl}/project/${projectId}/gallery`);
    if (!res.ok) return [];
    return res.json();
};

// --- main component ---
export default function Projects() {
    const [selectedProject, setSelectedProject] = useState<MediaItem | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // --- responsive header logic ---
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const HeaderTag = isMobile ? 'h3' : 'h1';

    // --- fetch projects ---
    const projectsQuery = useQueries({
        queries: [
            {
                queryKey: ['projects'],
                queryFn: fetchProjects,
                staleTime: PUBLIC_DATA_STALE_TIME_MS,
            },
        ],
    })[0];

    const projects: ApiProject[] = useMemo(
        () => [...(projectsQuery.data ?? [])].sort((a, b) => a.display_order - b.display_order),
        [projectsQuery.data],
    );
    const isLoading = projectsQuery.isLoading;
    const isError = projectsQuery.isError;
    const totalProjectCards = projects.length + 1;
    const totalPages = Math.max(Math.ceil(totalProjectCards / PROJECTS_PER_PAGE), 1);
    const pageStartIndex = (currentPage - 1) * PROJECTS_PER_PAGE;
    const pageProjects = useMemo(
        () => projects.slice(pageStartIndex, pageStartIndex + PROJECTS_PER_PAGE),
        [pageStartIndex, projects],
    );
    const showFutureProjectCard = pageStartIndex + pageProjects.length < totalProjectCards
        && pageStartIndex + PROJECTS_PER_PAGE >= totalProjectCards;

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    // --- fetch galleries for all projects in parallel ---
    const galleryQueries = useQueries({
        queries: pageProjects.map(project => ({
            queryKey: ['gallery', project.id],
            queryFn: () => fetchGalleryByProject(project.id),
            staleTime: PUBLIC_DATA_STALE_TIME_MS,
            enabled: !!pageProjects.length,
        })),
    });

    // --- transform flat ApiProject into MediaItem shape ---
    const displayProjects: MediaItem[] = useMemo(() => {
        const mapped = pageProjects.map((p, i) => ({
                id: p.id,
                title: p.title,
                type: p.type, // Map directly
                url: p.url,   // Map directly
                shortDescription: p.short_description, // Map directly
                longDescription: p.long_description,   // Map directly
                projectLink: p.project_link,           // Map directly
                gallery: galleryQueries[i]?.data?.sort((a, b) => a.display_order - b.display_order).map(g => ({
                    id: g.id,
                    title: '',
                    type: g.type,
                    url: g.url,
                    shortDescription: '',
                    longDescription: '',
                    projectLink: '',
                    gallery: [],
                })) ?? [],
            }));

        return showFutureProjectCard ? [...mapped, FUTURE_PROJECTS_CARD] : mapped;
    }, [galleryQueries, pageProjects, showFutureProjectCard]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleOpenProject = (project: MediaItem) => {
        if (project.id === FUTURE_PROJECTS_CARD.id) return;
        setSelectedProject(project);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setTimeout(() => setSelectedProject(null), 300);
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
                name: "Projects",
                item: "https://syn-forge.com/projects",
            },
        ],
    };

    return (
        <>
            <GlobalHeadManager
                title="Projects"
                description="Browse software projects by John-Ronan Beira, including web apps, React interfaces, Cloudflare-backed tools, Python experiments, and other technical work."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/projects"
                jsonLd={breadcrumbSchema}
            />

            <CookingArea>
                <div className="container py-3">
                    <HeaderTag className="mb-4">Light and easy things that I've been working on.</HeaderTag>

                    {isLoading && (
                        <div className="d-flex justify-content-center my-5">
                            <div className="spinner-border text-primary" role="status"></div>
                        </div>
                    )}

                    {!isLoading && !isError && (
                        <>
                            <Grid projects={displayProjects} onProjectClick={handleOpenProject} />
                            <PaginationControls
                                currentPage={currentPage}
                                itemLabel="projects"
                                onPageChange={handlePageChange}
                                pageSize={PROJECTS_PER_PAGE}
                                totalItems={totalProjectCards}
                                totalPages={totalPages}
                            />
                        </>
                    )}

                    <MediaModal
                        item={selectedProject}
                        show={showModal}
                        onClose={handleCloseModal}
                        detailsLabel="About this Project"
                        ctaLabel="View Project Source"
                    />
                </div>
            </CookingArea>
        </>
    );
}
