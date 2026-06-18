import { type CSSProperties } from "react";
import { ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import "../privacyPolicyPage/PrivacyPolicy.css";
import "./Netbird.css";

type NetbirdInfoItem = {
    label: string;
    value: string;
};

const netbirdSummary: NetbirdInfoItem[] = [
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
];

const netbirdPolicyRouteState = {
    returnLabel: "NetBird",
    returnTo: "/netbird",
};

export default function Netbird() {
    return (
        <>
            <GlobalHeadManager
                title="NetBird"
                description="NetBird access homepage for Syn-Forge infrastructure and Google project verification."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/netbird"
            />

            <CookingArea>
                <main className="privacy-policy-page netbird-page container py-3">
                    <header className="privacy-policy-hero netbird-hero">
                        <div className="privacy-policy-hero-copy">
                            <p className="privacy-policy-kicker">Syn-Forge private access</p>
                            <h1>NetBird</h1>
                            <p className="privacy-policy-summary">
                                This page identifies the NetBird access application used for Syn-Forge network administration, project verification, and authorized private infrastructure access.
                            </p>
                            <p className="privacy-policy-summary">
                                Google Sign-In may be used to confirm identity for approved users. Google account data is not sold, used for advertising, or used outside the access and security purpose described here.
                            </p>
                            <div className="netbird-hero-actions">
                                <NavLink
                                    className="netbird-link-button"
                                    state={netbirdPolicyRouteState}
                                    to="/privacy-policy"
                                >
                                    <ShieldCheck aria-hidden="true" size={17} />
                                    Privacy Policy
                                </NavLink>
                                <NavLink
                                    className="netbird-link-button secondary"
                                    state={netbirdPolicyRouteState}
                                    to="/terms-and-conditions"
                                >
                                    <FileText aria-hidden="true" size={17} />
                                    Terms
                                </NavLink>
                            </div>
                        </div>

                        <dl className="privacy-policy-summary-grid">
                            {netbirdSummary.map((item, index) => (
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

                    <article className="privacy-policy-document netbird-document">
                        <section className="privacy-policy-section is-visible netbird-section">
                            <div className="privacy-policy-section-heading">
                                <span className="privacy-policy-section-number">
                                    <ShieldCheck aria-hidden="true" size={18} />
                                </span>
                                <h2>Google Project Verification</h2>
                            </div>
                            <p>
                                NetBird for Syn-Forge is used to manage private network access and administrative connectivity for systems operated under syn-forge.com.
                            </p>
                            <p>
                                When Google authentication is enabled, the application uses the authorized Google account information only to identify the user, maintain access control, and protect private infrastructure.
                            </p>
                            <ul>
                                <li>Requested Google data is limited to authentication and authorization needs.</li>
                                <li>Access is intended for approved users and administrative workflows.</li>
                                <li>Privacy and terms disclosures are available from this page for verification review.</li>
                            </ul>
                        </section>

                        <section className="privacy-policy-section is-visible netbird-section">
                            <div className="privacy-policy-section-heading">
                                <span className="privacy-policy-section-number">
                                    <ExternalLink aria-hidden="true" size={18} />
                                </span>
                                <h2>Related Policies</h2>
                            </div>
                            <p>
                                Syn-Forge policy pages describe the covered properties, Google OAuth data handling, service providers, retention, user requests, and contact path for privacy questions.
                            </p>
                            <div className="netbird-policy-links">
                                <NavLink state={netbirdPolicyRouteState} to="/privacy-policy">
                                    <ShieldCheck aria-hidden="true" size={17} />
                                    Read the Privacy Policy
                                </NavLink>
                                <NavLink state={netbirdPolicyRouteState} to="/terms-and-conditions">
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
