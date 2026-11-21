import { resizeImage } from "../../data/imageTransform";
import AsyncImage from "../asyncImageLoader/AsyncImage";
import { LoadingBlock, LoadingRegion } from "../loadingState/LoadingState";

interface ProfileImageProps {
  figureClassName?: string;
  src?: string;
  /** Alternative text for the portrait; the page supplies a descriptive value. */
  alt?: string;
  isLoading: boolean;
}

export default function ProfileImageComponent({
  figureClassName = "",
  src,
  alt = "Profile",
  isLoading,
}: ProfileImageProps) {
  if (isLoading || !src) {
    return (
      <LoadingRegion
        className={`aspect-square w-44 border border-line bg-surface-raised lg:justify-self-end ${figureClassName}`}
        label="Preparing profile image"
      >
        <LoadingBlock className="loading-image-square" />
      </LoadingRegion>
    );
  }

  // The portrait is 180 px square; ask the edge for 360 so it stays sharp at DPR2.
  // An untransformable source (the relative default, a foreign avatar host) returns
  // null and renders exactly what it rendered before this change.
  const transformedSrc = resizeImage(src, 360);

  return (
    <figure
      className={`relative aspect-square w-44 border border-line-strong bg-surface p-1 lg:justify-self-end ${figureClassName}`}
    >
      <AsyncImage
        src={transformedSrc ?? src}
        alt={alt}
        decoding="async"
        fallbackSrc={transformedSrc ? src : undefined}
        fetchPriority={transformedSrc ? "high" : undefined}
        height={180}
        loading="eager"
        width={180}
        wrapperClassName="block h-full w-full"
        className="h-full w-full object-cover"
      />
      <span className="absolute -bottom-2 -right-2 h-4 w-4 bg-signal" aria-hidden="true" />
    </figure>
  );
}
