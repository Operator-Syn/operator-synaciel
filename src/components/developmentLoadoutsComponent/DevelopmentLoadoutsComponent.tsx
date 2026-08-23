import DevelopmentLoadoutsShowcase from "./DevelopmentLoadoutsShowcase";

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

export default function DevelopmentLoadoutsComponent({ content, isLoading }: DevLoadoutsProps) {
  if (isLoading || !content) {
    return (
      <div className="surface-panel min-h-72 animate-pulse p-6" aria-hidden="true">
        <div className="h-6 w-1/2 bg-surface-raised" />
        <div className="mt-8 h-32 w-full bg-surface-raised" />
      </div>
    );
  }

  return <DevelopmentLoadoutsShowcase content={content} />;
}
