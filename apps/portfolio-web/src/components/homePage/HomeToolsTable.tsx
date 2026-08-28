import {
  Box,
  Circle,
  Code2,
  Database,
  Layers,
  type LucideIcon,
  Monitor,
  Network,
  Rocket,
  Wrench,
} from "lucide-react";
import type { HomePageTypes } from "../../types/HomePageTypes";
import { LoadingBlock, LoadingRegion } from "../loadingState/LoadingState";

interface CategoryMeta {
  Icon: LucideIcon;
  label: string;
}

interface HomeToolsTableProps {
  isError: boolean;
  isLoading: boolean;
  sections: HomePageTypes["sections"]["loadouts"];
}

function getCategoryMeta(category: string): CategoryMeta {
  const normalized = category.toLowerCase();

  if (normalized.includes("operating")) return { Icon: Monitor, label: "Systems" };
  if (normalized.includes("programming")) return { Icon: Code2, label: "Languages" };
  if (normalized.includes("framework")) return { Icon: Layers, label: "Frameworks" };
  if (normalized.includes("database")) return { Icon: Database, label: "Data & DB" };
  if (normalized.includes("virtual") || normalized.includes("container"))
    return { Icon: Box, label: "Containers" };
  if (normalized.includes("network")) return { Icon: Network, label: "Network" };
  if (normalized.includes("deploy") || normalized.includes("hosting"))
    return { Icon: Rocket, label: "Deploy" };
  if (normalized.includes("tool")) return { Icon: Wrench, label: "Dev tools" };
  return { Icon: Circle, label: category };
}

export default function HomeToolsTable({ isError, isLoading, sections }: HomeToolsTableProps) {
  return (
    <section className="homepage-tools" aria-labelledby="homepage-tools-title">
      <p className="meta-label" id="homepage-tools-title">
        Tools I Work With
      </p>
      {isLoading ? (
        <LoadingRegion className="homepage-tools-skeleton" label="Preparing tool list">
          {["one", "two", "three", "four", "five"].map((key) => (
            <LoadingBlock key={key} />
          ))}
        </LoadingRegion>
      ) : isError ? (
        <p className="homepage-inline-state">Tool data is temporarily unavailable.</p>
      ) : sections.length > 0 ? (
        <div className="homepage-tools-list">
          {sections.map((section) => {
            const { Icon, label } = getCategoryMeta(section.category);

            return (
              <div className="homepage-tool-row" data-cursor="cell" key={section.category}>
                <div className="homepage-tool-category">
                  <Icon aria-hidden="true" size={17} strokeWidth={1.5} />
                  <span>{label}</span>
                </div>
                <p>{section.tools.map((tool) => tool.label).join(", ") || "No tools configured"}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="homepage-inline-state">No tools configured.</p>
      )}
    </section>
  );
}
