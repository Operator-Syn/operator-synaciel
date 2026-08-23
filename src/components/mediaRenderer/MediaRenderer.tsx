// MediaRenderer.tsx
import AsyncImage from "../asyncImageLoader/AsyncImage";

interface MediaRendererProps {
  type: "video" | "image";
  url: string;
  className?: string;
  alt?: string;
  autoPlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  cursorState?: string;
}

export default function MediaRenderer({
  type,
  url,
  className,
  alt = "Media content",
  autoPlay = false,
  onPlay,
  onPause,
  cursorState,
}: MediaRendererProps) {
  const classes = className || "h-full w-full object-cover";

  if (type === "video") {
    return (
      <video
        controls={!autoPlay}
        autoPlay={autoPlay}
        muted={autoPlay}
        loop={autoPlay}
        aria-label={alt}
        className={classes}
        data-cursor={cursorState}
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

  return (
    <AsyncImage
      src={url}
      alt={alt}
      className={`${classes} block`}
      cursorState={cursorState}
      wrapperClassName="absolute inset-0 h-full w-full"
    />
  );
}
