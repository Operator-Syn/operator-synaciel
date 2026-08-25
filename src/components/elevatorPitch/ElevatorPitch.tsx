import { LoadingBlock, LoadingRegion } from "../loadingState/LoadingState";

interface ElevatorPitchItem {
  title: string;
  content: string;
}

interface ElevatorPitchProps {
  items?: ElevatorPitchItem[];
  isLoading?: boolean;
}

export default function ElevatorPitchComponent({ items, isLoading }: ElevatorPitchProps) {
  if (isLoading) {
    return (
      <LoadingRegion
        className="surface-panel min-h-72 p-6 legacy-panel-loading"
        label="Preparing profile note"
      >
        <LoadingBlock className="loading-line-title" />
        <LoadingBlock className="loading-line-copy" />
        <LoadingBlock className="loading-line-copy-short" />
      </LoadingRegion>
    );
  }

  if (!items || items.length === 0) {
    return (
      <section className="surface-panel p-6">
        <p className="eyebrow">Profile note</p>
        <p className="mt-6 text-text-muted">No profile note is configured.</p>
      </section>
    );
  }

  return (
    <section className="surface-panel p-6 sm:p-8">
      <p className="eyebrow mb-5">{items[0]?.title || "Profile note"}</p>
      <div className="max-w-3xl space-y-5 text-lg leading-relaxed text-text-muted">
        {items.map((item, index) => (
          <p key={`${item.title}-${index}`}>{item.content}</p>
        ))}
      </div>
    </section>
  );
}
