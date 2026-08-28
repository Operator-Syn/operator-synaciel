import { useState } from "react";
import AsyncImage from "../asyncImageLoader/AsyncImage";
import { LoadingStatus } from "../loadingState/LoadingState";

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
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const isReady = readyUrl === url;

  if (type === "video") {
    return (
      <span aria-busy={!isReady} className="media-renderer-frame">
        {!isReady && (
          <>
            <span aria-hidden="true" className="media-renderer-placeholder loading-placeholder" />
            <LoadingStatus label="Preparing media" />
          </>
        )}
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
          onLoadedData={() => setReadyUrl(url)}
          onError={() => setReadyUrl(url)}
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            if (!autoPlay) {
              e.currentTarget.currentTime = 0.5;
            }
          }}
        >
          <source src={url} />
          Your browser does not support the video tag.
        </video>
      </span>
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
