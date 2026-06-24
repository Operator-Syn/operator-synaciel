import { type CSSProperties } from "react";
import { FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import "../privacyPolicyPage/PrivacyPolicy.css";
import "./StaticAppPage.css";

export type StaticAppSummaryItem = {
    label: string;
    value: string;
};

export type StaticAppSection = {
    title: string;
    icon: LucideIcon;
    paragraphs: string[];
    listItems?: string[];
    includePolicyLinks?: boolean;
};

export type StaticAppPageConfig = {
    title: string;
    description: string;
    image: string;
    url: string;
    kicker: string;
    heading: string;
    heroParagraphs: string[];
    summaryItems: StaticAppSummaryItem[];
    policyReturnLabel: string;
    policyReturnTo: string;
    sections: StaticAppSection[];
};

type StaticAppPageProps = {
    config: StaticAppPageConfig;
};

export default function StaticAppPage({ config }: StaticAppPageProps) {
    const policyRouteState = {
        returnLabel: config.policyReturnLabel,
        returnTo: config.policyReturnTo,
    };

    return (
        <>
            <GlobalHeadManager
                title={config.title}
                description={config.description}
                image={config.image}
                url={config.url}
            />

            <CookingArea>
                <main className="privacy-policy-page static-app-page container py-3">
                    <header className="privacy-policy-hero static-app-hero">
                        <div className="privacy-policy-hero-copy">
                            <p className="privacy-policy-kicker">{config.kicker}</p>
                            <h1>{config.heading}</h1>
                            {config.heroParagraphs.map((paragraph) => (
                                <p className="privacy-policy-summary" key={paragraph}>
                                    {paragraph}
                                </p>
                            ))}
                            <div className="static-app-hero-actions">
                                <NavLink
                                    className="static-app-link-button"
                                    state={policyRouteState}
                                    to="/privacy-policy"
                                >
                                    <ShieldCheck aria-hidden="true" size={17} />
                                    Privacy Policy
                                </NavLink>
                                <NavLink
                                    className="static-app-link-button secondary"
                                    state={policyRouteState}
                                    to="/terms-and-conditions"
                                >
                                    <FileText aria-hidden="true" size={17} />
                                    Terms
                                </NavLink>
                            </div>
                        </div>

                        <dl className="privacy-policy-summary-grid">
                            {config.summaryItems.map((item, index) => (
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

                    <article className="privacy-policy-document static-app-document">
                        {config.sections.map((section) => {
                            const Icon = section.icon;

                            return (
                                <section className="privacy-policy-section is-visible static-app-section" key={section.title}>
                                    <div className="privacy-policy-section-heading">
                                        <span className="privacy-policy-section-number">
                                            <Icon aria-hidden="true" size={18} />
                                        </span>
                                        <h2>{section.title}</h2>
                                    </div>

                                    {section.paragraphs.map((paragraph) => (
                                        <p key={paragraph}>{paragraph}</p>
                                    ))}

                                    {section.listItems ? (
                                        <ul>
                                            {section.listItems.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    ) : null}

                                    {section.includePolicyLinks ? (
                                        <div className="static-app-policy-links">
                                            <NavLink state={policyRouteState} to="/privacy-policy">
                                                <ShieldCheck aria-hidden="true" size={17} />
                                                Read the Privacy Policy
                                            </NavLink>
                                            <NavLink state={policyRouteState} to="/terms-and-conditions">
                                                <FileText aria-hidden="true" size={17} />
                                                Read the Terms and Conditions
                                            </NavLink>
                                        </div>
                                    ) : null}
                                </section>
                            );
                        })}
                    </article>
                </main>
            </CookingArea>
        </>
    );
}
