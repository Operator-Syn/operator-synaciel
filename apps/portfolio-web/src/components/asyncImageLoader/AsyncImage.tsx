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
}

export default function AsyncImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  loader,
  cursorState: cursorStateOverride,
  draggable = false,
  ...props
}: AsyncImageProps) {
  const isPageTransitionActive = useContext(PageTransitionActiveContext);
  const [isLoaded, setIsLoaded] = useState(false);
  const suppressLoadFadeRef = useRef(isPageTransitionActive);
  const imgRef = useRef<HTMLImageElement>(null);

  if (isPageTransitionActive) suppressLoadFadeRef.current = true;

  useEffect(() => {
    setIsLoaded(false);
    const image = imgRef.current;
    if (image?.complete && image.getAttribute("src") === src) setIsLoaded(true);
  }, [src]);

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
        src={src}
        alt={alt}
        data-cursor={cursorState}
        decoding={props.decoding ?? "async"}
        draggable={draggable}
        className={imageClassName}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
      />
    </span>
  );
}
