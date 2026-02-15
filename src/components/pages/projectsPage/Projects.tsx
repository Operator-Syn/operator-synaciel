import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import CookingArea from "../../cookingArea/CookingArea";
import './Projects.css';
import { type MediaItem } from '../../../types/MediaCardTypes';
import Grid from '../../grid/Grid';
import MediaModal from '../../mediaModal/MediaModal';

interface ApiProject {
    id: number;
    title: string;
    thumbnail: { type: 'video' | 'image'; url: string; };
    description: { short: string; long: string; };
    link: string;
    gallery: Array<{ type: 'video' | 'image'; url: string; }>;
}

const fetchProjects = async (): Promise<MediaItem[]> => {
    const apiUrl = `${import.meta.env.VITE_API_URL}/projects`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Failed to fetch projects');
    const data: ApiProject[] = await response.json();
    return data.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.thumbnail.type, 
        url: item.thumbnail.url,   
        shortDescription: item.description.short,
        longDescription: item.description.long,
        projectLink: item.link,
        gallery: item.gallery
    }));
};

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

export default function Projects() {
    const [selectedProject, setSelectedProject] = useState<MediaItem | null>(null);
    const [showModal, setShowModal] = useState(false);

    const { data: projects = [], isLoading, isError } = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects,
        staleTime: 1000 * 60 * 30,             
    });

    const displayProjects = useMemo(() => {
        if (isLoading || isError) return [];
        return [...projects, FUTURE_PROJECTS_CARD];
    }, [projects, isLoading, isError]);

    const handlePrefetch = (item: MediaItem) => {
        if (item.gallery?.length > 0) {
            item.gallery.forEach(media => {
                if (media.type === 'image') {
                    const img = new Image();
                    img.src = media.url;
                }
            });
        }
    };

    const handleOpenProject = (item: MediaItem) => {
        if (item.id === FUTURE_PROJECTS_CARD.id) return;
        setSelectedProject(item);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false); 
        setTimeout(() => setSelectedProject(null), 300);
    };

    const triggerPrefetchFromEvent = (e: React.MouseEvent | React.TouchEvent) => {
        const target = (e.target as HTMLElement).closest('[data-project-id]');
        if (target) {
            const id = target.getAttribute('data-project-id');
            const project = displayProjects.find(p => p.id.toString() === id);
            if (project) handlePrefetch(project);
        }
    }

    return (
        <CookingArea>
            <div className="container py-3">
                <h1 className="mb-4 responsive-header">Light and easy things that I've been working on.</h1>

                {isLoading && (
                    <div className="d-flex justify-content-center my-5">
                        <div className="spinner-border text-primary" role="status"></div>
                    </div>
                )}

                {!isLoading && !isError && (
                    <div 
                        onMouseOver={triggerPrefetchFromEvent}
                        onTouchStart={triggerPrefetchFromEvent}
                    >
                        <Grid projects={displayProjects} onProjectClick={handleOpenProject} />
                    </div>
                )}

                <MediaModal project={selectedProject} show={showModal} onClose={handleCloseModal} />
            </div>
        </CookingArea>
    );
}