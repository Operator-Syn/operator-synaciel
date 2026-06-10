// src/components/developmentLoadoutsComponent/LoadoutTerminalOutput.tsx

import { useMemo } from "react";
import AsyncImage from "../asyncImageLoader/AsyncImage";

interface LoadoutTerminalOutputProps {
    category: string;
    badges: string[];
}

export default function LoadoutTerminalOutput({
    category,
    badges,
}: LoadoutTerminalOutputProps) {
    const cleanBadges = useMemo(() => {
        return badges.filter(Boolean);
    }, [badges]);

    if (cleanBadges.length === 0) {
        return <div className="loadout-empty-card">No badges configured.</div>;
    }

    return (
        <div
            className="loadout-badge-grid"
            role="list"
            aria-label={`${category} badges`}
        >
            {cleanBadges.map((badgeUrl, index) => (
                <AsyncImage
                    key={`${category}-${badgeUrl}-${index}`}
                    src={badgeUrl}
                    alt={`${category} badge ${index + 1}`}
                    wrapperClassName="badge-grid-item"
                    className="badge-grid-image"
                />
            ))}
        </div>
    );
}