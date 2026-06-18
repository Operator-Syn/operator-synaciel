import { type CSSProperties } from "react";
import { ExternalLink, FileText, LayoutDashboard, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import "../privacyPolicyPage/PrivacyPolicy.css";
import "./Atelier.css";

type AtelierInfoItem = {
    label: string;
    value: string;
};

const atelierSummary: AtelierInfoItem[] = [
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
];

const atelierPolicyRouteState = {
    returnLabel: "Atelier",
    returnTo: "/atelier",
};

export default function Atelier() {
    return (
        <>
            <GlobalHeadManager
                title="Atelier"
                description="Atelier dashboard homepage for Syn-Forge portfolio administration and application verification."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/atelier"
            />

            <CookingArea>
                <main className="privacy-policy-page atelier-page container py-3">
                    <header className="privacy-policy-hero atelier-hero">
                        <div className="privacy-policy-hero-copy">
                            <p className="privacy-policy-kicker">Syn-Forge portfolio dashboard</p>
                            <h1>Atelier</h1>
                            <p className="privacy-policy-summary">
                                This page identifies the dashboard application served at atelier.syn-forge.com for administering the Syn-Forge portfolio and related content workflows.
                            </p>
                            <p className="privacy-policy-summary">
                                Atelier is maintained in a separate dashboard repository and is used for authorized site operations, content updates, and administrative review for this portfolio.
                            </p>
                            <div className="atelier-hero-actions">
                                <NavLink
                                    className="atelier-link-button"
                                    state={atelierPolicyRouteState}
                                    to="/privacy-policy"
                                >
                                    <ShieldCheck aria-hidden="true" size={17} />
                                    Privacy Policy
                                </NavLink>
                                <NavLink
                                    className="atelier-link-button secondary"
                                    state={atelierPolicyRouteState}
                                    to="/terms-and-conditions"
                                >
                                    <FileText aria-hidden="true" size={17} />
                                    Terms
                                </NavLink>
                            </div>
                        </div>

                        <dl className="privacy-policy-summary-grid">
                            {atelierSummary.map((item, index) => (
                                <div
                                    className="privacy-policy-summary-item"
                                    key={item.label}
                                    style={{ "--summary-delay": `${index * 75}ms` } as CSSProperties}
                                >
                                    <dt>{item.label}</dt>
                                    <dd>{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </header>

                    <article className="privacy-policy-document atelier-document">
                        <section className="privacy-policy-section is-visible atelier-section">
                            <div className="privacy-policy-section-heading">
                                <span className="privacy-policy-section-number">
                                    <LayoutDashboard aria-hidden="true" size={18} />
                                </span>
                                <h2>Dashboard Verification</h2>
                            </div>
                            <p>
                                Atelier supports private administrative workflows for the Syn-Forge portfolio, including portfolio data updates, snippets management, and operational checks.
                            </p>
                            <p>
                                Access is intended for approved users only. Any account information used by the dashboard is handled for authentication, authorization, and site administration.
                            </p>
                            <ul>
                                <li>Atelier is associated with atelier.syn-forge.com.</li>
                                <li>The dashboard is separate from the public portfolio frontend.</li>
                                <li>Privacy and terms disclosures are available from this page for verification review.</li>
                            </ul>
                        </section>

                        <section className="privacy-policy-section is-visible atelier-section">
                            <div className="privacy-policy-section-heading">
                                <span className="privacy-policy-section-number">
                                    <ExternalLink aria-hidden="true" size={18} />
                                </span>
                                <h2>Related Policies</h2>
                            </div>
                            <p>
                                Syn-Forge policy pages describe the covered properties, data handling, service providers, retention, user requests, and contact path for privacy questions.
                            </p>
                            <div className="atelier-policy-links">
                                <NavLink state={atelierPolicyRouteState} to="/privacy-policy">
                                    <ShieldCheck aria-hidden="true" size={17} />
                                    Read the Privacy Policy
                                </NavLink>
                                <NavLink state={atelierPolicyRouteState} to="/terms-and-conditions">
                                    <FileText aria-hidden="true" size={17} />
                                    Read the Terms and Conditions
                                </NavLink>
                            </div>
                        </section>
                    </article>
                </main>
            </CookingArea>
        </>
    );
}
