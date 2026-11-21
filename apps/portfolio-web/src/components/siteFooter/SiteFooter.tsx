import { useLocation } from "react-router-dom";
import "../../styles/siteFooter.css";
import TransitionLink from "../pageTransition/TransitionLink";

/**
 * The site footer that closes every page except the home page.
 *
 * Algorithm:
 * 1. Read the current path.
 * 2. On `/`, render nothing: the home page already ends in its own closing section,
 *    and a second `contentinfo` landmark there would duplicate it for assistive technology.
 * 3. Otherwise render one footer: an identity block, a link per public route, and a
 *    copyright line.
 *
 * The identity block is not decoration. Shipped as bare links, this footer read as a
 * second navigation bar rather than the end of the page — the block is what
 * distinguishes the two. Every public route is listed, including the two legal pages,
 * because this element is the site's own index of itself.
 */

const SITE_LINKS = [
  { label: "Home", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Certificates", to: "/certificates" },
  { label: "Snippets", to: "/snippets" },
  { label: "AI", to: "/ai" },
  { label: "Privacy", to: "/privacy-policy" },
  { label: "Terms", to: "/terms-and-conditions" },
] as const;

export default function SiteFooter() {
  const { pathname } = useLocation();

  if (pathname === "/") return null;

  return (
    <footer className="site-footer">
      <div className="site-footer-identity">
        <p className="site-footer-name">Operator-Syn</p>
        <p className="site-footer-note">Calm interfaces, built and maintained in the open.</p>
      </div>
      <nav aria-label="Site" className="site-footer-nav">
        {SITE_LINKS.map((link) => (
          <TransitionLink className="site-footer-link" key={link.to} to={link.to}>
            {link.label}
          </TransitionLink>
        ))}
      </nav>
      <p className="site-footer-meta">
        © {new Date().getFullYear()} Operator-Syn — every page here is hand built.
      </p>
    </footer>
  );
}
