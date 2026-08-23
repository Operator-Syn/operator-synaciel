import {
  Box,
  Circle,
  Code2,
  Database,
  FileText,
  Layers,
  type LucideIcon,
  Monitor,
  Network,
  Palette,
  Rocket,
  Wrench,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import LoadoutTerminalOutput from "./LoadoutTerminalOutput";

interface DevLoadoutSection {
  category: string;
  badges: string[];
}
interface DevLoadoutsContent {
  header: string;
  sections: DevLoadoutSection[];
}
interface Props {
  content: DevLoadoutsContent;
}
interface CategoryMeta {
  Icon: LucideIcon;
  label: string;
}

const AUTO_SWITCH_DELAY_MS = 4500;

function getCategoryMeta(category: string): CategoryMeta {
  const normalized = category.toLowerCase();
  if (normalized.includes("operating")) return { Icon: Monitor, label: "Systems" };
  if (normalized.includes("programming")) return { Icon: Code2, label: "Code" };
  if (normalized.includes("framework")) return { Icon: Layers, label: "Frameworks" };
  if (normalized.includes("database")) return { Icon: Database, label: "Data" };
  if (normalized.includes("virtual") || normalized.includes("container"))
    return { Icon: Box, label: "Containers" };
  if (normalized.includes("network")) return { Icon: Network, label: "Network" };
  if (normalized.includes("deploy") || normalized.includes("hosting"))
    return { Icon: Rocket, label: "Deploy" };
  if (normalized.includes("design")) return { Icon: Palette, label: "Design" };
  if (normalized.includes("document")) return { Icon: FileText, label: "Docs" };
  if (normalized.includes("tool")) return { Icon: Wrench, label: "Tools" };
  return { Icon: Circle, label: category };
}

export default function DevelopmentLoadoutsShowcase({ content }: Props) {
  const componentId = useId();
  const sections = useMemo(
    () =>
      content.sections.filter((section) => section.category.trim() && section.badges.length > 0),
    [content.sections],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(sections.length - 1, 0)));
  }, [sections.length]);

  useEffect(() => {
    if (sections.length <= 1) return;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % sections.length),
      AUTO_SWITCH_DELAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [sections.length]);

  const activeSection = sections[activeIndex];

  return (
    <section className="surface-panel p-6 sm:p-8">
      <p className="eyebrow mb-5">{content.header}</p>
      {activeSection ? (
        <>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Development loadout categories"
          >
            {sections.map((section, index) => {
              const meta = getCategoryMeta(section.category);
              const Icon = meta.Icon;
              const isActive = index === activeIndex;

              return (
                <button
                  aria-label={meta.label}
                  aria-selected={isActive}
                  className={`inline-flex min-h-10 items-center gap-2 border px-3 font-mono text-meta uppercase tracking-[0.05em] transition-colors ${isActive ? "border-signal bg-signal text-canvas" : "border-line-strong text-text-muted hover:border-signal hover:text-signal"}`}
                  id={`${componentId}-tab-${index}`}
                  key={section.category}
                  onClick={() => setActiveIndex(index)}
                  role="tab"
                  title={meta.label}
                  type="button"
                >
                  <Icon aria-hidden="true" size={15} />
                  <span className="hidden sm:inline">{meta.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 border-t border-line pt-5" role="tabpanel">
            <p className="meta-label mb-4">{activeSection.category}</p>
            <LoadoutTerminalOutput
              category={activeSection.category}
              badges={activeSection.badges}
            />
          </div>
        </>
      ) : (
        <p className="text-text-muted">No tools configured.</p>
      )}
    </section>
  );
}
