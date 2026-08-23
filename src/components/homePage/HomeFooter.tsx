import type { IconType } from "react-icons";
import {
  FaDiscord,
  FaEnvelope,
  FaFacebookF,
  FaGithub,
  FaInstagram,
  FaLink,
  FaLinkedinIn,
  FaPaypal,
  FaSteam,
  FaXbox,
} from "react-icons/fa6";
import type { HomePageTypes } from "../../types/HomePageTypes";
import Clock from "../clock/Clock";

interface HomeFooterProps {
  links: HomePageTypes["sections"]["social"]["items"];
}

function getSocialIcon(label: string): IconType {
  const normalized = label.toLowerCase();

  if (normalized.includes("xbox")) return FaXbox;
  if (normalized.includes("steam")) return FaSteam;
  if (normalized.includes("linkedin")) return FaLinkedinIn;
  if (normalized.includes("paypal")) return FaPaypal;
  if (normalized.includes("github")) return FaGithub;
  if (normalized.includes("discord")) return FaDiscord;
  if (normalized.includes("facebook")) return FaFacebookF;
  if (normalized.includes("instagram")) return FaInstagram;
  if (normalized.includes("gmail") || normalized.includes("email")) return FaEnvelope;
  return FaLink;
}

export default function HomeFooter({ links }: HomeFooterProps) {
  return (
    <footer className="homepage-footer" data-home-section-index="2">
      <p className="homepage-section-index">
        04 <span>/ 04</span>
      </p>
      <Clock compact />
      <nav className="homepage-socials" aria-label="Social links">
        {links.map((link) => {
          const Icon = getSocialIcon(link.label);

          return (
            <a
              className="homepage-social-link"
              href={link.target_url}
              key={`${link.label}-${link.target_url}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon aria-hidden="true" size={15} />
              <span>{link.label === "GMail" ? "Email" : link.label}</span>
            </a>
          );
        })}
      </nav>
    </footer>
  );
}
