import AsyncImage from "../asyncImageLoader/AsyncImage";
import { LoadingBlock, LoadingRegion } from "../loadingState/LoadingState";

interface ProfileImageProps {
  figureClassName?: string;
  src?: string;
  isLoading: boolean;
}

export default function ProfileImageComponent({
  figureClassName = "",
  src,
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

  return (
    <figure
      className={`relative aspect-square w-44 border border-line-strong bg-surface p-1 lg:justify-self-end ${figureClassName}`}
    >
      <AsyncImage
        src={src}
        alt="Profile"
        wrapperClassName="block h-full w-full"
        className="h-full w-full object-cover"
      />
      <span className="absolute -bottom-2 -right-2 h-4 w-4 bg-signal" aria-hidden="true" />
    </figure>
  );
}
