import { ExternalLink, ShieldCheck } from "lucide-react";
import StaticAppPage, { type StaticAppPageConfig } from "../staticAppPage/StaticAppPage";

const netbirdPageConfig: StaticAppPageConfig = {
    title: "NetBird",
    description: "NetBird access homepage for Syn-Forge infrastructure and Google project verification.",
    image: "https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png",
    url: "https://syn-forge.com/netbird",
    kicker: "Syn-Forge private access",
    heading: "NetBird",
    heroParagraphs: [
        "This page identifies the NetBird access application used for Syn-Forge network administration, project verification, and authorized private infrastructure access.",
        "Google Sign-In may be used to confirm identity for approved users. Google account data is not sold, used for advertising, or used outside the access and security purpose described here.",
    ],
    summaryItems: [
        {
            label: "Application",
            value: "NetBird access for Syn-Forge infrastructure",
        },
        {
            label: "Operator",
            value: "Syn-Forge and Operator-Syn, operated by John-Ronan S. Beira",
        },
        {
            label: "Purpose",
            value: "Private network access, device enrollment, and administrative access verification",
        },
        {
            label: "Google use",
            value: "Google Sign-In is used only to authenticate and authorize approved access",
        },
    ],
    policyReturnLabel: "NetBird",
    policyReturnTo: "/netbird",
    sections: [
        {
            title: "Google Project Verification",
            icon: ShieldCheck,
            paragraphs: [
                "NetBird for Syn-Forge is used to manage private network access and administrative connectivity for systems operated under syn-forge.com.",
                "When Google authentication is enabled, the application uses the authorized Google account information only to identify the user, maintain access control, and protect private infrastructure.",
            ],
            listItems: [
                "Requested Google data is limited to authentication and authorization needs.",
                "Access is intended for approved users and administrative workflows.",
                "Privacy and terms disclosures are available from this page for verification review.",
            ],
        },
        {
            title: "Related Policies",
            icon: ExternalLink,
            paragraphs: [
                "Syn-Forge policy pages describe the covered properties, Google OAuth data handling, service providers, retention, user requests, and contact path for privacy questions.",
            ],
            includePolicyLinks: true,
        },
    ],
};

export default function Netbird() {
    return <StaticAppPage config={netbirdPageConfig} />;
}
