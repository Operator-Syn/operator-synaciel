import { type ImgHTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react";

interface AsyncImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  wrapperClassName?: string;
  loader?: ReactNode; // Accepts a custom loader component or JSX
  cursorState?: string;
}

export default function AsyncImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  loader, // <--- Destructure it
  cursorState: cursorStateOverride,
  draggable = false,
  ...props
}: AsyncImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIsLoaded(false);
    const image = imgRef.current;
    if (image?.complete && image.getAttribute("src") === src) {
      setIsLoaded(true);
    }
  }, [src]);

  // Check if we should show the default CSS placeholder
  // We ONLY show the generic CSS gray box if content is NOT loaded AND no custom loader was provided.
  const showDefaultCssPlaceholder = !isLoaded && !loader;
  const cursorState = cursorStateOverride ?? (draggable ? "grab" : "default");

  return (
    <span
      data-cursor={cursorState}
      className={`relative inline-block leading-none ${wrapperClassName} ${showDefaultCssPlaceholder ? "animate-pulse bg-surface-raised" : ""}`}
    >
      {/* A. CUSTOM LOADER: Render this while waiting, if provided */}
      {!isLoaded && loader && <span className="async-loader-content">{loader}</span>}

      {/* B. REAL IMAGE: Hidden until loaded */}
      <img
        {...props}
        ref={imgRef}
        src={src}
        alt={alt}
        data-cursor={cursorState}
        draggable={draggable}
        className={`${className} ${!isLoaded ? "hidden" : "animate-[image-fade-in_400ms_ease-out]"}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
      />
    </span>
  );
}
