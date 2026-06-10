// src/components/developmentLoadoutsComponent/DevelopmentLoadoutsShowcase.tsx

import { useEffect, useId, useMemo, useState } from "react";
import {
    Box,
    Circle,
    Code2,
    Database,
    FileText,
    Layers,
    Monitor,
    Network,
    Palette,
    Rocket,
    Wrench,
    type LucideIcon,
} from "lucide-react";
import "./DevelopmentLoadoutsComponent.css";
import LoadoutTerminalOutput from "./LoadoutTerminalOutput";

interface DevLoadoutSection {
    category: string;
    badges: string[];
}

interface DevLoadoutsContent {
    header: string;
    sections: DevLoadoutSection[];
}

interface DevelopmentLoadoutsShowcaseProps {
    content: DevLoadoutsContent;
}

interface CategoryMeta {
    Icon: LucideIcon;
    label: string;
}

const MIN_AUTO_SWITCH_DELAY_MS = 2500;
const MAX_AUTO_SWITCH_DELAY_MS = 3000;
const MANUAL_CLICK_PAUSE_MS = 5000;

function getRandomAutoSwitchDelay() {
    return Math.floor(
        MIN_AUTO_SWITCH_DELAY_MS +
            Math.random() *
                (MAX_AUTO_SWITCH_DELAY_MS - MIN_AUTO_SWITCH_DELAY_MS),
    );
}

function getCategoryMeta(category: string): CategoryMeta {
    const normalized = category.toLowerCase();

    if (normalized.includes("operating")) {
        return { Icon: Monitor, label: "Systems" };
    }

    if (normalized.includes("programming")) {
        return { Icon: Code2, label: "Code" };
    }

    if (normalized.includes("framework")) {
        return { Icon: Layers, label: "Frameworks" };
    }

    if (normalized.includes("database")) {
        return { Icon: Database, label: "Data" };
    }

    if (normalized.includes("virtual") || normalized.includes("container")) {
        return { Icon: Box, label: "Containers" };
    }

    if (normalized.includes("network")) {
        return { Icon: Network, label: "Network" };
    }

    if (normalized.includes("deploy") || normalized.includes("hosting")) {
        return { Icon: Rocket, label: "Deploy" };
    }

    if (normalized.includes("design")) {
        return { Icon: Palette, label: "Design" };
    }

    if (normalized.includes("document")) {
        return { Icon: FileText, label: "Docs" };
    }

    if (normalized.includes("tool")) {
        return { Icon: Wrench, label: "Tools" };
    }

    return {
        Icon: Circle,
        label: category,
    };
}

export default function DevelopmentLoadoutsShowcase({
    content,
}: DevelopmentLoadoutsShowcaseProps) {
    const { header, sections } = content;

    const componentId = useId();

    const cleanSections = useMemo(() => {
        return sections
            .map((section) => ({
                category: section.category.trim(),
                badges: section.badges.filter(Boolean),
            }))
            .filter((section) => section.category && section.badges.length > 0);
    }, [sections]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [manualPauseUntil, setManualPauseUntil] = useState<number | null>(
        null,
    );

    useEffect(() => {
        setActiveIndex((currentIndex) => {
            if (cleanSections.length === 0) {
                return 0;
            }

            return Math.min(currentIndex, cleanSections.length - 1);
        });
    }, [cleanSections.length]);

    useEffect(() => {
        if (cleanSections.length <= 1) {
            return;
        }

        const remainingManualPause =
            manualPauseUntil === null
                ? 0
                : Math.max(manualPauseUntil - Date.now(), 0);

        const delay = remainingManualPause + getRandomAutoSwitchDelay();

        const timeoutId = window.setTimeout(() => {
            setManualPauseUntil(null);

            setActiveIndex((currentIndex) => {
                return (currentIndex + 1) % cleanSections.length;
            });
        }, delay);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [activeIndex, cleanSections.length, manualPauseUntil]);

    const activeSection =
        cleanSections[
            Math.min(activeIndex, Math.max(cleanSections.length - 1, 0))
        ];

    function handleManualTabClick(index: number) {
        setActiveIndex(index);
        setManualPauseUntil(Date.now() + MANUAL_CLICK_PAUSE_MS);
    }

    return (
        <div className="light-glass-blue-hue development-loadouts-panel p-3 rounded shadow-sm">
            <h3 className="m-0">{header}</h3>
            <hr />

            {cleanSections.length > 0 && activeSection ? (
                <>
                    <div
                        className="loadout-tabs"
                        role="tablist"
                        aria-label="Development loadout categories"
                    >
                        {cleanSections.map((section, index) => {
                            const isActive = index === activeIndex;
                            const tabId = `${componentId}-loadout-tab-${index}`;
                            const meta = getCategoryMeta(section.category);
                            const Icon = meta.Icon;

                            return (
                                <button
                                    key={section.category}
                                    id={tabId}
                                    className={`loadout-tab ${
                                        isActive ? "is-active" : ""
                                    }`}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-label={meta.label}
                                    title={meta.label}
                                    onClick={() => handleManualTabClick(index)}
                                >
                                    <Icon
                                        className="loadout-tab-icon"
                                        aria-hidden="true"
                                        strokeWidth={2.15}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    <div className="loadout-active-card">
                        <LoadoutTerminalOutput
                            key={activeSection.category}
                            category={activeSection.category}
                            badges={activeSection.badges}
                        />
                    </div>
                </>
            ) : (
                <div className="loadout-empty-card">
                    No development badges configured yet.
                </div>
            )}
        </div>
    );
}