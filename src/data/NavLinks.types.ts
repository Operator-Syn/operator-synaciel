import type { NavLinkItem } from "../components/navBar/NavBar";
import { lazy } from "react";

export const brandName = "Operator-Syn";

export const navLinks: NavLinkItem[] = [
    { 
        name: "Home", 
        path: "/", 
        component: lazy(() => import("../components/pages/homePage/Home")) 
    },
    { 
        name: "Projects", 
        path: "/projects", 
        component: lazy(() => import("../components/pages/projectsPage/Projects")) 
    },
    { 
        name: "Certificates", 
        path: "/certificates", 
        component: lazy(() => import("../components/pages/certificatesPage/Certificates")) 
    },
    { 
        name: "Snippets", 
        path: "/snippets", 
        component: lazy(() => import("../components/pages/snippetsPage/Snippets")) 
    },
];