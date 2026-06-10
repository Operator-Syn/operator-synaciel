// src/components/developmentLoadoutsComponent/DevelopmentLoadoutsPlaceholder.tsx

import "./DevelopmentLoadoutsComponent.css";

interface PlaceholderProps {
    isMobile?: boolean;
}

export default function DevelopmentLoadoutsPlaceholder({
    isMobile = false,
}: PlaceholderProps) {
    const skeletonTabs = Array(6).fill(null);
    const skeletonBadges = Array(isMobile ? 4 : 8).fill(null);

    return (
        <div className="col-4 d-flex flex-column development-loadouts-column">
            <div
                className="light-glass-blue-hue development-loadouts-panel p-3 rounded shadow-sm placeholder-glow"
                aria-hidden="true"
            >
                <h3 className="m-0">
                    <span className="placeholder dev-loadouts-placeholder-title rounded"></span>
                </h3>
                <hr />

                <div className="loadout-tabs">
                    {skeletonTabs.map((_, index) => (
                        <span
                            key={index}
                            className={`loadout-tab dev-loadouts-placeholder-tab ${
                                index === 0 ? "is-active" : ""
                            }`}
                        >
                            <span className="placeholder dev-loadouts-placeholder-tab-icon rounded"></span>
                        </span>
                    ))}
                </div>

                <div className="loadout-active-card">
                    <div className="loadout-badge-grid">
                        {skeletonBadges.map((_, index) => (
                            <span
                                key={index}
                                className="badge-grid-item dev-loadouts-placeholder-badge-shell"
                            >
                                <span className="placeholder dev-loadouts-placeholder-badge rounded"></span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}