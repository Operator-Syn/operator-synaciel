import type { NavLinkItem } from "../components/navBar/NavBar";
import Home from "../components/pages/homePage/Home";
import Projects from "../components/pages/projectsPage/Projects";
import Snippets from "../components/pages/snippetsPage/Snippets";
import Certifications from "../components/pages/certificatesPage/Certificates";
import PrivacyPolicy from "../components/pages/privacyPolicyPage/PrivacyPolicy";
import TermsAndConditions from "../components/pages/termsAndConditionsPage/TermsAndConditions";
import Netbird from "../components/pages/netbirdPage/Netbird";

export const brandName = "Operator-Syn";

export interface RouteItem extends NavLinkItem {
    showInNav?: boolean;
}

export const routes: RouteItem[] = [
    { name: "Home", path: "/", component: Home, showInNav: true },
    { name: "Projects", path: "/projects", component: Projects, showInNav: true },
    { name: "Certificates", path: "/certificates", component: Certifications, showInNav: true },
    { name: "Snippets", path: "/snippets", component: Snippets, showInNav: true },
    { name: "Privacy", path: "/privacy-policy", component: PrivacyPolicy, showInNav: true },
    { name: "Terms", path: "/terms-and-conditions", component: TermsAndConditions, showInNav: true },
    { name: "NetBird", path: "/netbird", component: Netbird, showInNav: false },
];

export const navLinks: NavLinkItem[] = routes.filter((route) => route.showInNav !== false);
