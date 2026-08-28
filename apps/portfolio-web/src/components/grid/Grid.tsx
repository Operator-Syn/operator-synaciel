// Grid.tsx
import type { MediaItem } from "../../types/MediaCardTypes";
import MediaCard from "../mediaCard/MediaCard";

interface GridProps {
  projects: MediaItem[];
  onProjectClick: (project: MediaItem) => void;
}

export default function Grid({ projects, onProjectClick }: GridProps) {
  return (
    <div className="border-y border-line">
      {projects.map((item, index) => (
        <MediaCard key={item.id} index={index} project={item} onClick={onProjectClick} />
      ))}
    </div>
  );
}
