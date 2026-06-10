// src/components/developmentLoadoutsComponent/DevelopmentLoadoutsComponentForDesktop.tsx

import DevelopmentLoadoutsShowcase from "./DevelopmentLoadoutsShowcase";

interface DevLoadoutSection {
    category: string;
    badges: string[];
}

interface DevLoadoutsContent {
    header: string;
    sections: DevLoadoutSection[];
}

interface DevelopmentLoadoutsComponentForDesktopProps {
    content: DevLoadoutsContent;
}

export default function DevelopmentLoadoutsComponentForDesktop({
    content,
}: DevelopmentLoadoutsComponentForDesktopProps) {
    return (
        <div className="col-4 d-flex flex-column development-loadouts-column">
            <DevelopmentLoadoutsShowcase content={content} />
        </div>
    );
}