import {
  type ImgHTMLAttributes,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { PageTransitionActiveContext } from "../pageTransition/pageTransitionNavigation";

interface AsyncImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  wrapperClassName?: string;
  loader?: ReactNode;
  cursorState?: string;
  /**
   * Tried once, per URL, when `src` fails to load. Used to fall back from an image
   * transform to the original object.
   */
  fallbackSrc?: string;
}

export default function AsyncImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  loader,
  cursorState: cursorStateOverride,
  fallbackSrc,
  draggable = false,
  ...props
}: AsyncImageProps) {
  const isPageTransitionActive = useContext(PageTransitionActiveContext);
  const [isLoaded, setIsLoaded] = useState(false);
  // The URL that failed, not a boolean: when `src` changes the comparison stops
  // matching, so "try the fallback once" is per URL with no reset effect, and a
  // reused instance cannot paint a stale fallback for a frame.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const suppressLoadFadeRef = useRef(isPageTransitionActive);
  const imgRef = useRef<HTMLImageElement>(null);

  if (isPageTransitionActive) suppressLoadFadeRef.current = true;

  useEffect(() => {
    setIsLoaded(false);
    const image = imgRef.current;
    if (image?.complete && image.getAttribute("src") === src) setIsLoaded(true);
  }, [src]);

  const usingFallback = Boolean(fallbackSrc) && failedSrc === src && fallbackSrc !== src;
  const renderedSrc = usingFallback ? (fallbackSrc as string) : src;

  /**
   * Swap to the fallback when the transformed URL fails, and never loop: once
   * `failedSrc === src` a second error only resolves the loading state, so a failing
   * fallback cannot swap back or re-request. The loading state is resolved on every
   * error, so a broken image cannot leave the wrapper `aria-busy` forever.
   */
  const handleError = () => {
    setIsLoaded(true);
    if (failedSrc === src) return;
    if (!fallbackSrc || fallbackSrc === src) return;
    setFailedSrc(src);
    setIsLoaded(false);
  };

  const showDefaultCssPlaceholder = !isLoaded && !loader;
  const cursorState = cursorStateOverride ?? (draggable ? "grab" : "default");
  const imageClassName = [
    className,
    !isLoaded
      ? "opacity-0"
      : suppressLoadFadeRef.current
        ? ""
        : "animate-[image-fade-in_400ms_ease-out]",
  ]
    .filter(Boolean)
    .join(" ");
  const wrapperClass = [
    "relative inline-block leading-none",
    wrapperClassName,
    showDefaultCssPlaceholder ? "loading-placeholder" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span data-cursor={cursorState} aria-busy={!isLoaded} className={wrapperClass}>
      {!isLoaded && loader && <span className="async-loader-content">{loader}</span>}
      <img
        {...props}
        ref={imgRef}
        src={renderedSrc}
        alt={alt}
        data-cursor={cursorState}
        decoding={props.decoding ?? "async"}
        draggable={draggable}
        className={imageClassName}
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
      />
    </span>
  );
}
