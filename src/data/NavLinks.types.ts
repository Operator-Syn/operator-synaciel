import type { NavLinkItem } from "../components/navBar/NavBar";
import Home from "../components/pages/homePage/Home";
import Projects from "../components/pages/projectsPage/Projects";
import Snippets from "../components/pages/snippetsPage/Snippets";
import Certifications from "../components/pages/certificatesPage/Certificates";
import PrivacyPolicy from "../components/pages/privacyPolicyPage/PrivacyPolicy";

export const brandName = "Operator-Syn";

export const navLinks: NavLinkItem[] = [
    { name: "Home", path: "/", component: Home },
    { name: "Projects", path: "/projects", component: Projects },
    { name: "Certificates", path: "/certificates", component: Certifications },
    { name: "Snippets", path: "/snippets", component: Snippets },
    { name: "Privacy", path: "/privacy-policy", component: PrivacyPolicy },
];
