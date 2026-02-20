// src/components/pages/projectsPage/Projects.tsx
import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import CookingArea from "../../cookingArea/CookingArea";
import './Projects.css';
import { type MediaItem } from '../../../types/MediaCardTypes';
import Grid from '../../grid/Grid';
import MediaModal from '../../mediaModal/MediaModal';

interface ApiProject {
    id: number;
    title: string;
    thumbnail: { type: 'video' | 'image'; url: string };
    description: { short: string; long: string };
    link: string;
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

    // --- fetch projects ---
    const projectsQuery = useQueries({
        queries: [
            {
                queryKey: ['projects'],
                queryFn: fetchProjects,
                staleTime: 1000 * 60 * 30,
            },
        ],
    })[0];

    const projects: ApiProject[] = projectsQuery.data ?? [];
    const isLoading = projectsQuery.isLoading;
    const isError = projectsQuery.isError;

    // --- fetch galleries for all projects in parallel ---
    const galleryQueries = useQueries({
        queries: projects.map(project => ({
            queryKey: ['gallery', project.id],
            queryFn: () => fetchGalleryByProject(project.id),
            staleTime: 1000 * 60 * 30,
            enabled: !!projects.length, // only if projects exist
        })),
    });

    // --- transform projects into MediaItem shape ---
    const displayProjects: MediaItem[] = useMemo(() => {
        return [
            ...projects.map((p, i) => ({
                id: p.id,
                title: p.title,
                type: p.thumbnail.type,
                url: p.thumbnail.url,
                shortDescription: p.description.short,
                longDescription: p.description.long,
                projectLink: p.link,
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
            })),
            FUTURE_PROJECTS_CARD
        ];
    }, [projects, galleryQueries]);

    const handleOpenProject = (project: MediaItem) => {
        if (project.id === FUTURE_PROJECTS_CARD.id) return;
        setSelectedProject(project);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setTimeout(() => setSelectedProject(null), 300);
    };

    return (
        <CookingArea>
            <div className="container py-3">
                <h1 className="mb-4">Light and easy things that I've been working on.</h1>

                {isLoading && (
                    <div className="d-flex justify-content-center my-5">
                        <div className="spinner-border text-primary" role="status"></div>
                    </div>
                )}

                {!isLoading && !isError && (
                    <Grid projects={displayProjects} onProjectClick={handleOpenProject} />
                )}

                <MediaModal
                    project={selectedProject}
                    show={showModal}
                    onClose={handleCloseModal}
                />
            </div>
        </CookingArea>
    );
}
