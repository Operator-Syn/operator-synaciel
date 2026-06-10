// src/components/columnPanels/socialLinksComponent/SocialLinksComponent.tsx
import SocialLinksPlaceholder from "./SocialLinksPlaceholder";
import AsyncImage from "../../asyncImageLoader/AsyncImage";
import "./SocialLinks.css";

interface SocialLink {
    href: string;
    img: string;
    alt: string;
}

interface SocialLinksComponentProps {
    badges: SocialLink[];
    isLoading?: boolean;
}

export default function SocialLinksComponent({
    badges,
    isLoading,
}: SocialLinksComponentProps) {
    if (isLoading) {
        return <SocialLinksPlaceholder />;
    }

    return (
        <div className="light-glass-blue-hue flex-grow-1 p-3 rounded shadow-sm d-flex flex-column justify-content-center social-links-panel">
            <div className="d-flex flex-wrap gap-2 justify-content-center align-items-center social-links-badge-grid">
                {badges.map((badge, index) => (
                    <SocialBadge key={index} badge={badge} />
                ))}
            </div>
        </div>
    );
}

function SocialBadge({ badge }: { badge: SocialLink }) {
    return (
        <a
            href={badge.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none social-link-anchor"
            aria-label={badge.alt}
        >
            <AsyncImage
                src={badge.img}
                alt={badge.alt}
                wrapperClassName="badge-wrapper d-inline-flex align-items-center justify-content-center rounded overflow-hidden"
                className="badge-img d-block"
            />
        </a>
    );
}