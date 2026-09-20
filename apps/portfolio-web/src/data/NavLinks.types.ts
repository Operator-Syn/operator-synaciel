import { lazy } from "react";
import type { NavLinkItem } from "../components/navBar/NavBar";
import Home from "../components/pages/homePage/Home";

const Agent = lazy(() => import("../components/pages/agentPage/Agent"));
const Ai = lazy(() => import("../components/pages/aiPage/Ai"));
const Atelier = lazy(() => import("../components/pages/atelierPage/Atelier"));
const Certifications = lazy(() => import("../components/pages/certificatesPage/Certificates"));
const Netbird = lazy(() => import("../components/pages/netbirdPage/Netbird"));
const PrivacyPolicy = lazy(() => import("../components/pages/privacyPolicyPage/PrivacyPolicy"));
const Projects = lazy(() => import("../components/pages/projectsPage/Projects"));
const Snippets = lazy(() => import("../components/pages/snippetsPage/Snippets"));
const TermsAndConditions = lazy(
  () => import("../components/pages/termsAndConditionsPage/TermsAndConditions"),
);

export const brandName = "Operator-Syn";

export interface RouteItem extends NavLinkItem {
  showInNav?: boolean;
}

export const routes: RouteItem[] = [
  { name: "Home", path: "/", component: Home, showInNav: true },
  { name: "Projects", path: "/projects", component: Projects, showInNav: true },
  { name: "Certificates", path: "/certificates", component: Certifications, showInNav: true },
  { name: "Snippets", path: "/snippets", component: Snippets, showInNav: true },
  { name: "Privacy", path: "/privacy-policy", component: PrivacyPolicy, showInNav: false },
  { name: "Terms", path: "/terms-and-conditions", component: TermsAndConditions, showInNav: false },
  { name: "NetBird", path: "/netbird", component: Netbird, showInNav: false },
  { name: "Atelier", path: "/atelier", component: Atelier, showInNav: false },
  { name: "AI and MCP", path: "/ai", component: Ai, showInNav: false },
  { name: "Feilhann Agent", path: "/agent", component: Agent, showInNav: false },
];

export const navLinks: NavLinkItem[] = routes.filter((route) => route.showInNav !== false);
