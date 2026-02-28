import { type MediaItem } from '../../types/MediaCardTypes';
import MediaRenderer from '../mediaRenderer/MediaRenderer';

interface MediaCardProps {
    project: MediaItem;
    onClick: (project: MediaItem) => void;
}

export default function MediaCard({ project, onClick }: MediaCardProps) {
    return (
        <div 
            className="card light-glass-blue-hue h-100 shadow-sm overflow-hidden cursor-pointer"
            onClick={() => onClick(project)}
            data-project-id={project.id} 
        >
            <div className="ratio ratio-16x9 bg-dark">
                <MediaRenderer 
                    type={project.type} 
                    url={project.url} 
                    className="object-fit-cover w-100 h-100" 
                />
            </div>
            <div className="card-body">
                <h5 className="card-title global-font-color">{project.title}</h5>
                <hr className='border-top border-2 opacity-100 my-2'></hr>
                <p className="card-text">
                    {project.shortDescription}
                </p>
            </div>
        </div>
    );
}