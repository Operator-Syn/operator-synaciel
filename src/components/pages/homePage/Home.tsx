// src/pages/Home/Home.tsx
import { useQueries } from "@tanstack/react-query";
import type { HomePageTypes } from "../../../types/HomePageTypes";
import "./Home.css";
import HeaderComponent from "../../headerComponent/HeaderComponent";
import ElevatorPitchComponent from "../../elevatorPitch/ElevatorPitch";
import CookingArea from "../../cookingArea/CookingArea";
import ColumnPanels from "../../columnPanels/ColumnPanels";
import ProfileImageComponent from "../../profileImageComponent/ProfileImageComponent";
import DevelopmentLoadoutsComponent from "../../developmentLoadoutsComponent/DevelopmentLoadoutsComponent";

const apiUrl = import.meta.env.VITE_API_URL;

const fetchSettings = async () => {
    const res = await fetch(`${apiUrl}/settings`);
    if (!res.ok) throw new Error("Failed to fetch site settings");
    return res.json();
};

const fetchProfile = async () => {
    const res = await fetch(`${apiUrl}/profile`);
    if (!res.ok) throw new Error("Failed to fetch profile");
    return res.json();
};

const fetchSections = async () => {
    const res = await fetch(`${apiUrl}/sections`);
    if (!res.ok) throw new Error("Failed to fetch sections");
    const sections = await res.json();

    const sectionItemsPromises = sections.map(async (section: any) => {
        const itemsRes = await fetch(`${apiUrl}/sections/${section.id}/items`);
        if (!itemsRes.ok) throw new Error(`Failed to fetch items for section ${section.title}`);
        const items = await itemsRes.json();
        return { ...section, items };
    });

    return Promise.all(sectionItemsPromises);
};

export default function Home() {
    const results = useQueries({
        queries: [
            { queryKey: ["settings"], queryFn: fetchSettings, staleTime: 1000 * 60 * 30 },
            { queryKey: ["profile"], queryFn: fetchProfile, staleTime: 1000 * 60 * 30 },
            { queryKey: ["sections"], queryFn: fetchSections, staleTime: 1000 * 60 * 30 },
        ]
    });

    const isLoading = results.some(r => r.isLoading);
    const isError = results.some(r => r.isError);

    if (isError) return <div className="p-5 text-center text-danger">Error loading portfolio data.</div>;

    const site = results[0].data ?? {};
    const profile = results[1].data ?? [];
    const rawSections = results[2].data ?? [];

    // ASSEMBLY BLOCK: This now collects ALL matching sections from the DB
    const sections = {
        pitch: { items: [] as any[] },
        social: { items: [] as any[] },
        loadouts: [] as any[],
    };

    rawSections.forEach((section: any) => {
        switch (section.section_type) {
            case "pitch":
                // If you add a new 'pitch' section in DB, it appends here
                section.items.forEach((item: any) => {
                    sections.pitch.items.push({ 
                        title: section.title, 
                        content: item.content 
                    });
                });
                break;
            case "social":
                // If you add a new 'social' section in DB, it appends here
                section.items.forEach((item: any) => sections.social.items.push({
                    label: item.label,
                    image_url: item.image_url,
                    target_url: item.target_url
                }));
                break;
            case "loadout":
                // If you add a new 'loadout' section (e.g. "Tools"), it appends here
                const cat = { 
                    category: section.title, 
                    badges: section.items.map((i: any) => i.image_url).filter(Boolean) 
                };
                sections.loadouts.push(cat);
                break;
        }
    });

    const data: HomePageTypes = { site, profile, sections };

    return (
        <CookingArea>
            <div className="container-fluid py-3">
                <div className="row g-3 mb-3 d-flex align-items-stretch stack-on-mobile">
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

                {/* THE GRID: Kept exactly the same to prevent breaking layout */}
                <div className="row g-3 stack-on-mobile">
                    <div className="col-4 d-flex flex-column">
                        <ElevatorPitchComponent isLoading={isLoading} items={data.sections.pitch.items} />
                    </div>
                    <DevelopmentLoadoutsComponent
                        isLoading={isLoading}
                        content={data ? { header: "Development Loadouts", sections: data.sections.loadouts } : undefined}
                    />
                    <ColumnPanels
                        isLoading={isLoading}
                        profileInfo={data.profile}
                        socialLinks={data.sections.social.items.map(link => ({
                            href: link.target_url,
                            img: link.image_url,
                            alt: link.label
                        }))}
                        className="order-first-on-mobile"
                    />
                </div>
            </div>
        </CookingArea>
    );
}