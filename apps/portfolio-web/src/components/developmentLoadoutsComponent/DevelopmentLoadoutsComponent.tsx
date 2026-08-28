import { LoadingBlock, LoadingRegion } from "../loadingState/LoadingState";
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
      <LoadingRegion
        className="surface-panel min-h-72 p-6 legacy-panel-loading"
        label="Preparing development loadouts"
      >
        <LoadingBlock className="loading-line-title" />
        <LoadingBlock className="loading-loadout-stage" />
      </LoadingRegion>
    );
  }

  return <DevelopmentLoadoutsShowcase content={content} />;
}
