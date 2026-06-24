import { ExternalLink, LayoutDashboard } from "lucide-react";
import StaticAppPage, { type StaticAppPageConfig } from "../staticAppPage/StaticAppPage";

const atelierPageConfig: StaticAppPageConfig = {
    title: "Atelier",
    description: "Atelier dashboard homepage for Syn-Forge portfolio administration and application verification.",
    image: "https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png",
    url: "https://syn-forge.com/atelier",
    kicker: "Syn-Forge portfolio dashboard",
    heading: "Atelier",
    heroParagraphs: [
        "This page identifies the dashboard application served at atelier.syn-forge.com for administering the Syn-Forge portfolio and related content workflows.",
        "Atelier is maintained in a separate dashboard repository and is used for authorized site operations, content updates, and administrative review for this portfolio.",
    ],
    summaryItems: [
        {
            label: "Application",
            value: "Atelier dashboard for the Syn-Forge portfolio",
        },
        {
            label: "Operator",
            value: "Syn-Forge and Operator-Syn, operated by John-Ronan S. Beira",
        },
        {
            label: "Domain",
            value: "atelier.syn-forge.com",
        },
        {
            label: "Purpose",
            value: "Portfolio content management, snippets administration, and site operations",
        },
    ],
    policyReturnLabel: "Atelier",
    policyReturnTo: "/atelier",
    sections: [
        {
            title: "Dashboard Verification",
            icon: LayoutDashboard,
            paragraphs: [
                "Atelier supports private administrative workflows for the Syn-Forge portfolio, including portfolio data updates, snippets management, and operational checks.",
                "Access is intended for approved users only. Any account information used by the dashboard is handled for authentication, authorization, and site administration.",
            ],
            listItems: [
                "Atelier is associated with atelier.syn-forge.com.",
                "The dashboard is separate from the public portfolio frontend.",
                "Privacy and terms disclosures are available from this page for verification review.",
            ],
        },
        {
            title: "Related Policies",
            icon: ExternalLink,
            paragraphs: [
                "Syn-Forge policy pages describe the covered properties, data handling, service providers, retention, user requests, and contact path for privacy questions.",
            ],
            includePolicyLinks: true,
        },
    ],
};

export default function Atelier() {
    return <StaticAppPage config={atelierPageConfig} />;
}
