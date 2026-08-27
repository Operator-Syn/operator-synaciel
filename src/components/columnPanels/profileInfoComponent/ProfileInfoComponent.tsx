import { LoadingBlock, LoadingRegion } from "../../loadingState/LoadingState";

interface ProfileInfoItem {
  label: string;
  value: string;
}

interface ProfileInfoPanelProps {
  items: ProfileInfoItem[];
  isLoading?: boolean;
}

export default function ProfileInfoComponent({ items, isLoading }: ProfileInfoPanelProps) {
  if (isLoading) {
    return (
      <LoadingRegion
        className="surface-panel p-5 legacy-panel-loading"
        label="Preparing profile panel"
      >
        <LoadingBlock className="loading-line-title" />
        <LoadingBlock className="loading-line-copy-short" />
      </LoadingRegion>
    );
  }

  return (
    <section className="surface-panel p-5">
      <p className="eyebrow mb-4">Profile / 01</p>
      <dl className="grid gap-3">
        {items.map((info) => (
          <div
            className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
            key={`${info.label}-${info.value}`}
          >
            <dt className="meta-label">{info.label}</dt>
            <dd className="text-sm text-text">{info.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
