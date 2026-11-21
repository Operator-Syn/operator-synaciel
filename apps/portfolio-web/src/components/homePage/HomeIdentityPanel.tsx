import { LoadingBlock, LoadingRegion } from "../loadingState/LoadingState";
import ProfileImageComponent from "../profileImageComponent/ProfileImageComponent";

interface ProfileInfoItem {
  label: string;
  value: string;
}

interface HomeIdentityPanelProps {
  image?: string;
  isLoading: boolean;
  profile: ProfileInfoItem[];
  status?: string;
}

export default function HomeIdentityPanel({
  image,
  isLoading,
  profile,
  status,
}: HomeIdentityPanelProps) {
  // The API exposes the display name as a label/value pair; the portrait's
  // alternative text reuses it so the image is described by who it shows.
  const profileName = profile.find((item) => item.label === "Name")?.value?.trim();
  const profileAlt = profileName ? `Portrait of ${profileName}` : "Profile";

  return (
    <section className="homepage-identity" aria-labelledby="homepage-identity-title">
      <div className="homepage-identity-main">
        <ProfileImageComponent
          alt={profileAlt}
          figureClassName="homepage-profile-image"
          isLoading={isLoading}
          src={image}
        />
        <div className="homepage-identity-details">
          <h2 className="sr-only" id="homepage-identity-title">
            Profile
          </h2>
          {isLoading ? (
            <LoadingRegion className="homepage-identity-skeleton" label="Preparing profile details">
              <LoadingBlock />
              <LoadingBlock />
              <LoadingBlock />
            </LoadingRegion>
          ) : (
            <dl>
              {profile.map((item) => (
                <div className="homepage-identity-row" key={`${item.label}-${item.value}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
              <div className="homepage-identity-row">
                <dt>Status</dt>
                <dd className="is-signal">{status || "Building with intent."}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
