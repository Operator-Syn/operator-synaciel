import { useLocation } from "react-router-dom";
import "../../styles/siteFooter.css";
import TransitionLink from "../pageTransition/TransitionLink";

/**
 * Route links that close every page except the home page.
 *
 * Algorithm:
 * 1. Read the current path.
 * 2. On `/`, render nothing: the home page ends in `HomeFooter`, and a second
 *    `contentinfo` landmark there would duplicate it for assistive technology.
 * 3. Otherwise render one footer with a link per top-level route, each a
 *    `TransitionLink` so navigation keeps the app's page transition.
 */

const SITE_LINKS = [
  { label: "Home", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Certificates", to: "/certificates" },
  { label: "Snippets", to: "/snippets" },
  { label: "AI", to: "/ai" },
] as const;

export default function SiteFooter() {
  const { pathname } = useLocation();

  if (pathname === "/") return null;

  return (
    <footer className="site-footer">
      <nav aria-label="Site" className="site-footer-nav">
        {SITE_LINKS.map((link) => (
          <TransitionLink className="site-footer-link" key={link.to} to={link.to}>
            {link.label}
          </TransitionLink>
        ))}
      </nav>
    </footer>
  );
}
