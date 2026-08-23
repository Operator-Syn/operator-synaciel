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
  return (
    <section className="homepage-identity" aria-labelledby="homepage-identity-title">
      <div className="homepage-identity-main">
        <ProfileImageComponent
          figureClassName="homepage-profile-image"
          isLoading={isLoading}
          src={image}
        />
        <div className="homepage-identity-details">
          <h2 className="sr-only" id="homepage-identity-title">
            Profile
          </h2>
          {isLoading ? (
            <div className="homepage-identity-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
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
