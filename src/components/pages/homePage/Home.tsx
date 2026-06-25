import { useQueries } from "@tanstack/react-query";
import type { HomePageTypes } from "../../../types/HomePageTypes";
import "./Home.css";
import HeaderComponent from "../../headerComponent/HeaderComponent";
import ElevatorPitchComponent from "../../elevatorPitch/ElevatorPitch";
import CookingArea from "../../cookingArea/CookingArea";
import ColumnPanels from "../../columnPanels/ColumnPanels";
import ProfileImageComponent from "../../profileImageComponent/ProfileImageComponent";
import DevelopmentLoadoutsComponent from "../../developmentLoadoutsComponent/DevelopmentLoadoutsComponent";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";

interface SectionApiItem {
    label?: string;
    content?: string;
    image_url?: string;
    target_url?: string;
}

interface SectionApiRow {
    id: number;
    title: string;
    section_type: string;
    items: SectionApiItem[];
}

interface HomeSectionMap {
    pitch: {
        items: Array<{
            title: string;
            content: string;
        }>;
    };
    social: {
        items: Array<{
            label: string;
            image_url: string;
            target_url: string;
        }>;
    };
    loadouts: Array<{
        category: string;
        badges: string[];
    }>;
}

const apiUrl = import.meta.env.VITE_API_URL;

const fetchSettings = async () => {
    const res = await fetch(`${apiUrl}/settings`);

    if (!res.ok) {
        throw new Error("Failed to fetch site settings");
    }

    return res.json();
};

const fetchProfile = async () => {
    const res = await fetch(`${apiUrl}/profile`);

    if (!res.ok) {
        throw new Error("Failed to fetch profile");
    }

    return res.json();
};

const fetchSections = async () => {
    const res = await fetch(`${apiUrl}/sections`);

    if (!res.ok) {
        throw new Error("Failed to fetch sections");
    }

    const sections = (await res.json()) as Array<{ id: number; title: string; section_type: string }>;

    const sectionItemsPromises = sections.map(async (section) => {
        const itemsRes = await fetch(`${apiUrl}/sections/${section.id}/items`);

        if (!itemsRes.ok) {
            throw new Error(`Failed to fetch items for section ${section.title}`);
        }

        const items = (await itemsRes.json()) as SectionApiItem[];

        return {
            ...section,
            items,
        };
    });

    return Promise.all(sectionItemsPromises);
};

export default function Home() {
    const results = useQueries({
        queries: [
            {
                queryKey: ["settings"],
                queryFn: fetchSettings,
                staleTime: PUBLIC_DATA_STALE_TIME_MS,
            },
            {
                queryKey: ["profile"],
                queryFn: fetchProfile,
                staleTime: PUBLIC_DATA_STALE_TIME_MS,
            },
            {
                queryKey: ["sections"],
                queryFn: fetchSections,
                staleTime: PUBLIC_DATA_STALE_TIME_MS,
            },
        ],
    });

    const isLoading = results.some((result) => result.isLoading);
    const isError = results.some((result) => result.isError);

    if (isError) {
        return (
            <div className="p-5 text-center text-danger">
                Error loading portfolio data.
            </div>
        );
    }

    const site = results[0].data ?? {};
    const profile = results[1].data ?? [];
    const rawSections = results[2].data ?? [];

    const sections: HomeSectionMap = {
        pitch: {
            items: [],
        },
        social: {
            items: [],
        },
        loadouts: [],
    };

    rawSections.forEach((section: SectionApiRow) => {
        switch (section.section_type) {
            case "pitch":
                section.items.forEach((item) => {
                    sections.pitch.items.push({
                        title: section.title,
                        content: item.content ?? "",
                    });
                });
                break;

            case "social":
                section.items.forEach((item) => {
                    sections.social.items.push({
                        label: item.label ?? "",
                        image_url: item.image_url ?? "",
                        target_url: item.target_url ?? "",
                    });
                });
                break;

            case "loadout":
                sections.loadouts.push({
                    category: section.title,
                    badges: section.items
                        .map((item) => item.image_url)
                        .filter((badge): badge is string => Boolean(badge)),
                });
                break;

            default:
                break;
        }
    });

    const data: HomePageTypes = {
        site,
        profile,
        sections,
    };

    return (
        <>
            <GlobalHeadManager
                title="Home"
                description="This software development portfolio presents a comprehensive showcase of full-stack projects, development tools, and technical expertise. It highlights web applications, open-source contributions, and innovative solutions, providing insight into the developer’s professional experience, programming skills, and problem-solving capabilities. Visitors can explore detailed project implementations, development loadouts, and software engineering achievements designed to demonstrate proficiency in modern web and software development practices."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/"
            />

            <CookingArea>
                <div className="container-fluid py-3 home-page">
                    <div className="row g-3 mb-4 d-flex align-items-center stack-on-mobile home-hero-row">
                        <HeaderComponent
                            isLoading={isLoading}
                            headerPhrase={data.site?.headerPhrase}
                            mobileHeaderPhrase={data.site?.mobileHeaderPhrase}
                        />

                        <ProfileImageComponent
                            isLoading={isLoading}
                            src={data.site?.profileImage}
                            className="order-first-on-mobile"
                        />
                    </div>

                    <div className="row g-3 stack-on-mobile home-content-grid">
                        <div className="col-4 d-flex flex-column home-primary-panel">
                            <ElevatorPitchComponent
                                isLoading={isLoading}
                                items={data.sections.pitch.items}
                            />
                        </div>

                        <DevelopmentLoadoutsComponent
                            isLoading={isLoading}
                            content={{
                                header: "Tools I Work With",
                                sections: data.sections.loadouts,
                            }}
                        />

                        <ColumnPanels
                            isLoading={isLoading}
                            profileInfo={data.profile}
                            socialLinks={data.sections.social.items.map((link) => ({
                                href: link.target_url,
                                img: link.image_url,
                                alt: link.label,
                            }))}
                            className="home-side-panel order-first-on-mobile"
                        />
                    </div>
                </div>
            </CookingArea>
        </>
    );
}
