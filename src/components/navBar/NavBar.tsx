import { Menu, X } from "lucide-react";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

export interface NavLinkItem {
  name: string;
  path: string;
  component?: FC | null;
}

interface NavBarProps {
  brandName: string;
  links: NavLinkItem[];
}

export default function NavBar({ brandName, links }: NavBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const location = useLocation();

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (navRef.current && !navRef.current.contains(event.target as Node)) {
      setExpanded(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollYRef.current;

      setIsScrolled(currentScrollY > 12);

      if (currentScrollY <= 12 || scrollDelta < -4 || expanded) {
        setIsNavHidden(false);
      } else if (scrollDelta > 4) {
        setIsNavHidden(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = window.scrollY;
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [expanded]);

  useEffect(() => {
    const root = document.documentElement;

    if (isNavHidden && !expanded) {
      root.dataset.navigationHidden = "true";
    } else {
      delete root.dataset.navigationHidden;
    }

    return () => {
      delete root.dataset.navigationHidden;
    };
  }, [expanded, isNavHidden]);

  useEffect(() => {
    if (location.pathname) setExpanded(false);
  }, [location.pathname]);

  return (
    <header
      ref={navRef}
      className={`navigation-shell fixed inset-x-0 top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-md transition-shadow ${isScrolled || expanded ? "shadow-panel" : ""}`}
      data-navigation-hidden={isNavHidden && !expanded ? "true" : "false"}
    >
      <div className="page-frame-wide flex min-h-[4.5rem] items-center justify-between gap-6 px-0">
        <NavLink
          className="font-display text-2xl leading-none text-text no-underline transition-colors hover:text-signal"
          to="/"
        >
          {brandName}
        </NavLink>

        <button
          aria-controls="main-navigation"
          aria-expanded={expanded}
          aria-label={expanded ? "Close navigation" : "Open navigation"}
          className="inline-grid min-h-11 min-w-11 place-items-center border border-line-strong bg-transparent text-text transition-colors hover:border-signal hover:text-signal lg:hidden"
          onClick={() => setExpanded((prev) => !prev)}
          type="button"
        >
          {expanded ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
        </button>

        <nav
          aria-label="Primary navigation"
          className={`${expanded ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col border-b border-line bg-canvas px-4 py-3 lg:static lg:flex lg:flex-row lg:items-center lg:gap-8 lg:border-0 lg:bg-transparent lg:p-0`}
          id="main-navigation"
        >
          {links.map((link) => (
            <NavLink
              key={link.path}
              className={({ isActive }) =>
                `border-b-2 border-transparent py-3 font-body text-base leading-none no-underline transition-colors lg:py-7 ${isActive ? "border-signal text-signal" : "text-text-muted hover:border-signal hover:text-signal-strong"}`
              }
              end={link.path === "/"}
              to={link.path}
            >
              {link.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
