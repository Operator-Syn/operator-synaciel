// src/components/developmentLoadoutsComponent/DevelopmentLoadoutsComponent.tsx

import { useEffect, useState } from "react";
import DesktopComponent from "./DevelopmentLoadoutsComponentForDesktop";
import MobileComponent from "./DevelopmentLoadoutsComponentForMobile";
import DevelopmentLoadoutsPlaceholder from "./DevelopmentLoadoutsPlaceholder";

interface DevLoadoutSection {
    category: string;
    badges: string[];
}

interface DevLoadoutsContent {
    header: string;
    sections: DevLoadoutSection[];
}

interface DevLoadoutsProps {
    content?: DevLoadoutsContent;
    isLoading?: boolean;
}

export default function DevelopmentLoadoutsComponent({
    content,
    isLoading,
}: DevLoadoutsProps) {
    const [isSmall, setIsSmall] = useState<boolean>(() =>
        typeof window !== "undefined" ? window.innerWidth <= 1400 : false,
    );

    useEffect(() => {
        const handleResize = () => {
            setIsSmall(window.innerWidth <= 1400);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    if (isLoading || !content) {
        return <DevelopmentLoadoutsPlaceholder isMobile={isSmall} />;
    }

    return isSmall ? (
        <MobileComponent content={content} />
    ) : (
        <DesktopComponent content={content} />
    );
}