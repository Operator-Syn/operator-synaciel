import { useState, useEffect, useRef, type ImgHTMLAttributes, type ReactNode } from "react";
import "./AsyncImage.css";

interface AsyncImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    wrapperClassName?: string;
    loader?: ReactNode; // Accepts a custom loader component or JSX
}

export default function AsyncImage({ 
    src, 
    alt, 
    className = "", 
    wrapperClassName = "",
    loader, // <--- Destructure it
    ...props 
}: AsyncImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setIsLoaded(false);
        if (imgRef.current && imgRef.current.complete) {
            setIsLoaded(true);
        }
    }, [src]);

    // Check if we should show the default CSS placeholder
    // We ONLY show the generic CSS gray box if content is NOT loaded AND no custom loader was provided.
    const showDefaultCssPlaceholder = !isLoaded && !loader;

    return (
        <span 
            className={`async-image-wrapper ${wrapperClassName} ${showDefaultCssPlaceholder ? "placeholder-glow placeholder" : ""}`}
        >
            {/* A. CUSTOM LOADER: Render this while waiting, if provided */}
            {!isLoaded && loader && (
                <span className="async-loader-content">
                    {loader}
                </span>
            )}

            {/* B. REAL IMAGE: Hidden until loaded */}
            <img
                {...props}
                ref={imgRef}
                src={src}
                alt={alt}
                className={`${className} ${!isLoaded ? "async-image-hidden" : "async-image-visible"}`}
                onLoad={() => setIsLoaded(true)}
                onError={() => setIsLoaded(true)}
            />
        </span>
    );
}
