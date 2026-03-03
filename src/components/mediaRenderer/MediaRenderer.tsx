// MediaRenderer.tsx
import AsyncImage from "../asyncImageLoader/AsyncImage";
import "./MediaRenderer.css"; 

interface MediaRendererProps {
    type: 'video' | 'image';
    url: string;
    className?: string;
    autoPlay?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
}

export default function MediaRenderer({ 
    type, 
    url, 
    className, 
    autoPlay = false,
    onPlay,
    onPause
}: MediaRendererProps) {
    // Standard classes for the inner media element (img/video)
    const classes = className || "object-fit-cover w-100 h-100";

    if (type === 'video') {
        return (
            <video 
                controls={!autoPlay} 
                autoPlay={autoPlay} 
                muted={autoPlay} 
                loop={autoPlay} 
                className={classes}
                onPlay={onPlay}   
                onPause={onPause}
                onEnded={onPause}
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
                onLoadedMetadata={(e) => {
                    // Intelligent Thumbnailing: 
                    // If not autoplaying, seek to 0.5s to show a preview frame
                    if (!autoPlay) {
                        e.currentTarget.currentTime = 0.5;
                    }
                }}
            >
                <source src={url} />
                Your browser does not support the video tag.
            </video>
        );
    }

    // IMAGE HANDLING FIX:
    // We added 'position-absolute top-0 start-0' to wrapperClassName.
    // This forces the AsyncImage wrapper to snap to the top-left of the .ratio container,
    // fixing the issue where the image was pushed down below the dark box.
    return (
        <AsyncImage 
            src={url} 
            alt="media content" 
            className={`${classes} media-renderer-fix`} 
            wrapperClassName="w-100 h-100 position-absolute top-0 start-0" 
        />
    );
}