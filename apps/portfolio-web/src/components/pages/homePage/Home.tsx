import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Grid2X2 } from "lucide-react";
import { HOMEPAGE_STALE_TIME_MS } from "../../../data/cacheSettings";
import { HOME_PAGE_DESCRIPTION } from "../../../data/socialPreview";
import type { HomePageApiResponse, HomePageTypes } from "../../../types/HomePageTypes";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import HomeCoordinates from "../../homePage/HomeCoordinates";
import HomeFooter from "../../homePage/HomeFooter";
import HomeIdentityPanel from "../../homePage/HomeIdentityPanel";
import HomeSelectedWork from "../../homePage/HomeSelectedWork";
import HomeToolsTable from "../../homePage/HomeToolsTable";
import useHomepageMotion from "../../homePage/useHomepageMotion";
import TransitionLink from "../../pageTransition/TransitionLink";

interface SectionApiItem {
  content: string | null;
  image_url: string | null;
  label: string | null;
  target_url: string | null;
}

interface SectionApiRow {
  id: number;
  items: SectionApiItem[];
  section_type: string;
  title: string;
}

const apiUrl = import.meta.env.VITE_API_URL;
const HERO_BODY_FALLBACK = "A portfolio of projects, experiments, and the thinking behind them.";

const fetchHomePage = async (): Promise<HomePageApiResponse> => {
  const response = await fetch(`${apiUrl}/home`);
  if (!response.ok) throw new Error("Failed to fetch homepage data");
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
            label: item.label || parseBadgeLabel(item.image_url ?? undefined),
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
  const { isMotionReady } = useHomepageMotion();
  const homeQuery = useQuery({
    queryKey: ["home"],
    queryFn: fetchHomePage,
    staleTime: HOMEPAGE_STALE_TIME_MS,
    retry: false,
  });

  const site = homeQuery.data?.site ?? {};
  const profile = homeQuery.data?.profile ?? [];
  const sections = buildSections(homeQuery.data?.sections ?? []);
  const projects = [...(homeQuery.data?.projects ?? [])].sort(
    (left, right) => left.display_order - right.display_order,
  );
  const heroCopy = getHeroCopy(site);
  const isHeroLoading = homeQuery.isLoading;

  return (
    <>
      <GlobalHeadManager
        description={HOME_PAGE_DESCRIPTION}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          author: { "@type": "Person", name: "Operator-Syn", url: "https://syn-forge.com/" },
          description: HOME_PAGE_DESCRIPTION,
          name: "Syn-Forge",
          url: "https://syn-forge.com/",
        }}
        title="Software Developer Portfolio"
        url="https://syn-forge.com/"
      />

      <CookingArea>
        <div className={`homepage-shell${isMotionReady ? " homepage-motion-ready" : ""}`}>
          <HomeCoordinates />

          <section
            aria-busy={isHeroLoading}
            className="homepage-hero"
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
                      {homeQuery.isError
                        ? "Portfolio notes are temporarily unavailable."
                        : HERO_BODY_FALLBACK}
                    </p>
                  )}
                </div>
                <div className="homepage-hero-actions">
                  <TransitionLink
                    className="homepage-action homepage-action-primary"
                    to="/projects"
                  >
                    View projects
                    <ArrowRight aria-hidden="true" size={17} />
                  </TransitionLink>
                  <TransitionLink
                    className="homepage-action homepage-action-secondary"
                    to="/snippets"
                  >
                    Browse archive
                    <Grid2X2 aria-hidden="true" size={16} />
                  </TransitionLink>
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
                  isError={homeQuery.isError}
                  isLoading={homeQuery.isLoading}
                  sections={sections.loadouts}
                />
              </div>
            </div>
          </section>

          <HomeSelectedWork
            isError={homeQuery.isError}
            isLoading={homeQuery.isLoading}
            projects={projects}
          />
          <HomeFooter isLoading={homeQuery.isLoading} links={sections.social.items} />
        </div>
      </CookingArea>
    </>
  );
}
