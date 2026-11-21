import { useState } from "react";
import { resizeImage } from "../../data/imageTransform";
import AsyncImage from "../asyncImageLoader/AsyncImage";
import { LoadingStatus } from "../loadingState/LoadingState";

/** How an image should be sized and scheduled. Video media ignores this entirely. */
export interface MediaImageOptions {
  /** Pixel width requested from the image service. */
  transformWidth: number;
  /** Canvas height, used with `fit` to normalise the asset's shape. */
  transformHeight?: number;
  fit?: "pad" | "crop";
  background?: "transparent";
  /** Display-box ratio for the element, not the source file's pixel dimensions. */
  width: number;
  height: number;
  /** Scheduling hint; omitted when the URL could not be transformed. */
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

interface MediaRendererProps {
  type: "video" | "image";
  url: string;
  className?: string;
  /** Alternative text. Required: every caller must state what the media shows. */
  alt: string;
  image?: MediaImageOptions;
  autoPlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  cursorState?: string;
}

export default function MediaRenderer({
  type,
  url,
  className,
  alt,
  image,
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

  // Everything below hangs on whether a transform actually happened, not on whether a
  // descriptor was supplied: a foreign host, a relative path, a data URI or an
  // already-transformed URL renders exactly as it does today — no ratio hint and no
  // self-referential fallback.
  const transformed = image
    ? resizeImage(url, image.transformWidth, undefined, {
        height: image.transformHeight,
        fit: image.fit,
        background: image.background,
      })
    : null;

  return (
    <AsyncImage
      src={transformed ?? url}
      alt={alt}
      className={`${classes} block`}
      cursorState={cursorState}
      decoding="async"
      fallbackSrc={transformed ? url : undefined}
      fetchPriority={transformed ? image?.fetchPriority : undefined}
      height={transformed ? image?.height : undefined}
      loading={transformed ? image?.loading : undefined}
      width={transformed ? image?.width : undefined}
      wrapperClassName="absolute inset-0 h-full w-full"
    />
  );
}
