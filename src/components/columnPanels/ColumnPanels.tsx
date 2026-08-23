import Clock from "../clock/Clock";
import ProfileInfoComponent from "./profileInfoComponent/ProfileInfoComponent";
import SocialLinksComponent from "./socialLinksComponent/SocialLinksComponent";

interface ProfileInfoItem {
  label: string;
  value: string;
}
interface SocialLink {
  href: string;
  img: string;
  alt: string;
}

interface ColumnPanelProps {
  profileInfo?: ProfileInfoItem[];
  socialLinks?: SocialLink[];
  isLoading?: boolean;
}

export default function ColumnPanels({
  profileInfo,
  socialLinks,
  isLoading = false,
}: ColumnPanelProps) {
  return (
    <div className="grid gap-5">
      <ProfileInfoComponent items={profileInfo ?? []} isLoading={isLoading} />
      <SocialLinksComponent badges={socialLinks ?? []} isLoading={isLoading} />
      <Clock />
    </div>
  );
}
