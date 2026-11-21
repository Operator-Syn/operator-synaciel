import { useLocation } from "react-router-dom";
import "../../styles/siteFooter.css";
import TransitionLink from "../pageTransition/TransitionLink";

/**
 * The utility footer that closes every page except the home page.
 *
 * Algorithm:
 * 1. Read the current path.
 * 2. On `/`, render nothing: the home page already ends in its own closing section,
 *    and a second `contentinfo` landmark there would duplicate it for assistive technology.
 * 3. Otherwise render one row: the copyright line, then a link per public route.
 *
 * This element is deliberately the quietest thing on the page. It speaks in the same
 * register as the header navigation — IBM Plex Sans, sentence case, muted — instead of
 * borrowing the display serif and mono labels that the archive content uses. An earlier
 * version dressed it as a second masthead with a wordmark and a tagline, which read as
 * editorial furniture rather than the end of a document. A footer only has to say where
 * the page ends and what else exists.
 */

/** The product routes, in the same order the header presents them. */
const ROUTE_LINKS = [
  { label: "Home", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Certificates", to: "/certificates" },
  { label: "Snippets", to: "/snippets" },
  { label: "AI", to: "/ai" },
] as const;

/** The legal pages, which sit in their own group so they are not read as navigation. */
const LEGAL_LINKS = [
  { label: "Privacy", to: "/privacy-policy" },
  { label: "Terms", to: "/terms-and-conditions" },
] as const;

export default function SiteFooter() {
  const { pathname } = useLocation();

  if (pathname === "/") return null;

  return (
    <footer className="site-footer">
      <p className="site-footer-meta">© {new Date().getFullYear()} Operator-Syn</p>
      <nav aria-label="Site" className="site-footer-nav">
        <span className="site-footer-group">
          {ROUTE_LINKS.map((link) => (
            <TransitionLink className="site-footer-link" key={link.to} to={link.to}>
              {link.label}
            </TransitionLink>
          ))}
        </span>
        <span aria-hidden="true" className="site-footer-divider" />
        <span className="site-footer-group">
          {LEGAL_LINKS.map((link) => (
            <TransitionLink className="site-footer-link" key={link.to} to={link.to}>
              {link.label}
            </TransitionLink>
          ))}
        </span>
      </nav>
    </footer>
  );
}
