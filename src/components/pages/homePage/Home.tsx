import { useQueries } from "@tanstack/react-query";
import { ArrowRight, Grid2X2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PUBLIC_DATA_STALE_TIME_MS } from "../../../data/cacheSettings";
import type { HomePageTypes, HomeProject } from "../../../types/HomePageTypes";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import HomeCoordinates from "../../homePage/HomeCoordinates";
import HomeFooter from "../../homePage/HomeFooter";
import HomeIdentityPanel from "../../homePage/HomeIdentityPanel";
import HomeSelectedWork from "../../homePage/HomeSelectedWork";
import HomeToolsTable from "../../homePage/HomeToolsTable";
import useHomepageMotion from "../../homePage/useHomepageMotion";

interface SectionApiItem {
  content?: string;
  image_url?: string;
  label?: string;
  target_url?: string;
}

interface SectionApiRow {
  id: number;
  items: SectionApiItem[];
  section_type: string;
  title: string;
}

const apiUrl = import.meta.env.VITE_API_URL;

const fetchSettings = async (): Promise<Record<string, string>> => {
  const response = await fetch(`${apiUrl}/settings`);
  if (!response.ok) throw new Error("Failed to fetch site settings");
  return response.json();
};

const fetchProfile = async (): Promise<HomePageTypes["profile"]> => {
  const response = await fetch(`${apiUrl}/profile`);
  if (!response.ok) throw new Error("Failed to fetch profile");
  return response.json();
};

const fetchSections = async (): Promise<SectionApiRow[]> => {
  const response = await fetch(`${apiUrl}/sections`);
  if (!response.ok) throw new Error("Failed to fetch sections");

  const sections = (await response.json()) as Array<{
    id: number;
    section_type: string;
    title: string;
  }>;
  return Promise.all(
    sections.map(async (section) => {
      const itemsResponse = await fetch(`${apiUrl}/sections/${section.id}/items`);
      if (!itemsResponse.ok) throw new Error(`Failed to fetch items for section ${section.title}`);

      return {
        ...section,
        items: (await itemsResponse.json()) as SectionApiItem[],
      };
    }),
  );
};

const fetchProjects = async (): Promise<HomeProject[]> => {
  const response = await fetch(`${apiUrl}/projects`);
  if (!response.ok) throw new Error("Failed to fetch projects");
  return response.json();
};

function parseBadgeLabel(imageUrl = "") {
  const encodedLabel = imageUrl
    .split("/badge/")[1]
    ?.split("?")[0]
    ?.replace(/-[A-Fa-f0-9]{6,8}$/, "");
  if (!encodedLabel) return "Tool";

  try {
    return decodeURIComponent(encodedLabel).replace(/[_-]+/g, " ");
  } catch {
    return encodedLabel.replace(/[_-]+/g, " ");
  }
}

function buildSections(rows: SectionApiRow[]): HomePageTypes["sections"] {
  const sections: HomePageTypes["sections"] = {
    loadouts: [],
    pitch: { items: [] },
    social: { items: [] },
  };

  rows.forEach((section) => {
    if (section.section_type === "pitch") {
      section.items.forEach((item) => {
        if (item.content)
          sections.pitch.items.push({ content: item.content, title: section.title });
      });
    }

    if (section.section_type === "social") {
      section.items.forEach((item) => {
        if (item.target_url) {
          sections.social.items.push({
            image_url: item.image_url ?? "",
            label: item.label ?? "Link",
            target_url: item.target_url,
          });
        }
      });
    }

    if (section.section_type === "loadout") {
      sections.loadouts.push({
        category: section.title,
        tools: section.items
          .filter((item) => item.image_url)
          .map((item) => ({
            imageUrl: item.image_url ?? "",
            label: item.label || parseBadgeLabel(item.image_url),
          })),
      });
    }
  });

  return sections;
}

function getHeroCopy(site: HomePageTypes["site"]) {
  const fallback = "Calm Interfaces, Seamless Experiences — Welcome Visitors!";
  const phrase = site.headerPhrase?.trim() || fallback;
  const separatorIndex = phrase.indexOf(" — ");

  if (separatorIndex === -1) {
    return {
      kicker: site.mobileHeaderPhrase?.trim() || "Welcome Visitors!",
      title: phrase,
    };
  }

  return {
    kicker: phrase.slice(separatorIndex + 3).trim() || "Welcome Visitors!",
    title: `${phrase.slice(0, separatorIndex).trim()} —`,
  };
}

export default function Home() {
  const { activeSection, isMotionReady } = useHomepageMotion();
  const queries = useQueries({
    queries: [
      { queryKey: ["settings"], queryFn: fetchSettings, staleTime: PUBLIC_DATA_STALE_TIME_MS },
      { queryKey: ["profile"], queryFn: fetchProfile, staleTime: PUBLIC_DATA_STALE_TIME_MS },
      { queryKey: ["sections"], queryFn: fetchSections, staleTime: PUBLIC_DATA_STALE_TIME_MS },
      { queryKey: ["home-projects"], queryFn: fetchProjects, staleTime: PUBLIC_DATA_STALE_TIME_MS },
    ],
  });

  const settingsQuery = queries[0];
  const profileQuery = queries[1];
  const sectionsQuery = queries[2];
  const projectsQuery = queries[3];
  const site = (settingsQuery.data ?? {}) as HomePageTypes["site"];
  const profile = (profileQuery.data ?? []) as HomePageTypes["profile"];
  const sections = buildSections((sectionsQuery.data ?? []) as SectionApiRow[]);
  const projects = [...((projectsQuery.data ?? []) as HomeProject[])].sort(
    (left, right) => left.display_order - right.display_order,
  );
  const heroCopy = getHeroCopy(site);
  const isHeroLoading =
    settingsQuery.isLoading || profileQuery.isLoading || sectionsQuery.isLoading;

  return (
    <>
      <GlobalHeadManager
        description="Syn-Forge is the software developer portfolio of John-Ronan Beira."
        image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          author: { "@type": "Person", name: "John-Ronan Beira", url: "https://syn-forge.com/" },
          description: "Syn-Forge is the software developer portfolio of John-Ronan Beira.",
          name: "Syn-Forge",
          url: "https://syn-forge.com/",
        }}
        title="Software Developer Portfolio"
        url="https://syn-forge.com/"
      />

      <CookingArea>
        <div className={`homepage-shell${isMotionReady ? " homepage-motion-ready" : ""}`}>
          <HomeCoordinates activeSection={activeSection} />

          <section
            className="homepage-hero"
            data-home-section-index="0"
            aria-labelledby="homepage-hero-title"
          >
            <div className="homepage-hero-grid">
              <div className="homepage-hero-copy">
                <div className="homepage-hero-index">
                  <span>
                    01 <i>/ 04</i>
                  </span>
                </div>
                <h1 className="homepage-hero-title" id="homepage-hero-title">
                  {heroCopy.title}
                </h1>
                <p className="homepage-hero-kicker">{heroCopy.kicker}</p>
                <div className="homepage-hero-body" data-cursor="text">
                  {sections.pitch.items.length > 0 ? (
                    sections.pitch.items.map((item, index) => (
                      <p key={`${item.title}-${index}`}>{item.content}</p>
                    ))
                  ) : (
                    <p>
                      {sectionsQuery.isError
                        ? "Portfolio notes are temporarily unavailable."
                        : "A portfolio of projects, experiments, and the thinking behind them."}
                    </p>
                  )}
                </div>
                <div className="homepage-hero-actions">
                  <Link className="homepage-action homepage-action-primary" to="/projects">
                    View projects
                    <ArrowRight aria-hidden="true" size={17} />
                  </Link>
                  <Link className="homepage-action homepage-action-secondary" to="/snippets">
                    Browse archive
                    <Grid2X2 aria-hidden="true" size={16} />
                  </Link>
                </div>
              </div>

              <div className="homepage-hero-side">
                <HomeIdentityPanel
                  image={site.profileImage}
                  isLoading={isHeroLoading}
                  profile={profile}
                  status={site.status}
                />
                <HomeToolsTable
                  isError={sectionsQuery.isError}
                  isLoading={sectionsQuery.isLoading}
                  sections={sections.loadouts}
                />
              </div>
            </div>
          </section>

          <HomeSelectedWork
            isError={projectsQuery.isError}
            isLoading={projectsQuery.isLoading}
            projects={projects}
          />
          <HomeFooter links={sections.social.items} />
        </div>
      </CookingArea>
    </>
  );
}
