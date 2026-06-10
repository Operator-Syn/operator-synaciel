// src/components/developmentLoadoutsComponent/DevelopmentLoadoutsComponentForMobile.tsx

import DevelopmentLoadoutsShowcase from "./DevelopmentLoadoutsShowcase";

interface DevLoadoutSection {
    category: string;
    badges: string[];
}

interface DevLoadoutsContent {
    header: string;
    sections: DevLoadoutSection[];
}

interface DevelopmentLoadoutsComponentForMobileProps {
    content: DevLoadoutsContent;
}

export default function DevelopmentLoadoutsComponentForMobile({
    content,
}: DevelopmentLoadoutsComponentForMobileProps) {
    return (
        <div className="col-4 d-flex flex-column development-loadouts-column">
            <DevelopmentLoadoutsShowcase content={content} />
        </div>
    );
}