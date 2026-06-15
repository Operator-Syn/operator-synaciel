import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUp, ListTree, X } from "lucide-react";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import "../privacyPolicyPage/PrivacyPolicy.css";

type TermsSummaryItem = {
    label: string;
    value: string;
};

type TermsSection = {
    id: string;
    title: string;
    body: string[];
    items?: string[];
};

const termsSummary: TermsSummaryItem[] = [
    {
        label: "Provider",
        value: "Syn-Forge and Operator-Syn, operated by John-Ronan S. Beira",
    },
    {
        label: "Coverage",
        value: "syn-forge.com, Operator-Syn, and linked Syn-Forge applications",
    },
    {
        label: "Access",
        value: "Public portfolio pages, application features, and authenticated tools",
    },
    {
        label: "Google services",
        value: "Sign-in and API permissions are used only for user-authorized features",
    },
];

const termsSections: TermsSection[] = [
    {
        id: "acceptance-of-terms",
        title: "Acceptance of Terms",
        body: [
            "These Terms and Conditions govern your access to and use of syn-forge.com, Operator-Syn, and any related Syn-Forge application that links to this page.",
            "By visiting a covered property, using an application feature, signing in, or authorizing a connected service, you agree to follow these terms. If you do not agree, you should not use the covered property.",
        ],
    },
    {
        id: "covered-properties",
        title: "Covered Properties",
        body: [
            "These terms apply to pages and applications served from syn-forge.com or its subdomains, including Operator-Syn, unless a specific application provides its own terms.",
            "Links to third-party websites, platforms, repositories, identity providers, payment pages, or social networks are provided for convenience only. Those third-party services are governed by their own terms and policies.",
        ],
    },
    {
        id: "permitted-use",
        title: "Permitted Use",
        body: [
            "You may use covered properties for lawful personal, professional, portfolio, development, and application-related purposes.",
            "You are responsible for the information, files, permissions, credentials, instructions, and account access you provide while using a covered application.",
        ],
        items: [
            "Do not disrupt, overload, probe, reverse engineer, or bypass security controls.",
            "Do not access private administration areas, private files, non-public records, or restricted systems without permission.",
            "Do not submit content that is unlawful, harmful, infringing, misleading, abusive, or intended to compromise the service.",
            "Do not use scraping, credential attacks, automated traffic, or other activity that interferes with normal operation.",
        ],
    },
    {
        id: "accounts-and-authentication",
        title: "Accounts and Authentication",
        body: [
            "Some covered applications may require sign-in or authorization through Google or another identity provider. You are responsible for keeping your account credentials secure and for activity performed through your authenticated session.",
            "Access may be refused, limited, suspended, or revoked when needed to protect the service, investigate misuse, comply with legal obligations, enforce these terms, or preserve system integrity.",
        ],
    },
    {
        id: "google-api-and-oauth-features",
        title: "Google API and OAuth Features",
        body: [
            "If a covered application offers Google Sign-In or requests Google API permissions, those permissions are requested only to provide the visible feature you choose to use.",
            "You may deny or revoke Google authorization through your Google account settings. Denying or revoking access may disable or limit features that depend on that permission.",
        ],
        items: [
            "Google account information may be used to identify the signed-in user, maintain a session, and protect authenticated features.",
            "Additional Google API scopes are requested only when needed for an application feature that requires them.",
            "The Privacy Policy explains how Google user data is collected, used, retained, shared, and deleted.",
        ],
    },
    {
        id: "content-and-intellectual-property",
        title: "Content and Intellectual Property",
        body: [
            "The portfolio content, interface, text, images, project descriptions, snippets, layouts, and application materials made available through covered properties are owned by the provider or used with permission, unless stated otherwise.",
            "You may not copy, redistribute, sell, sublicense, or present covered property content as your own without permission, except where allowed by an applicable license, ordinary browser use, or applicable law.",
        ],
    },
    {
        id: "user-content-and-submissions",
        title: "User Content and Submissions",
        body: [
            "If a covered application allows you to submit content, files, messages, configuration, or other records, you remain responsible for what you submit and confirm that you have the rights needed to provide it.",
            "You grant the provider a limited permission to host, process, display, transmit, secure, and maintain submitted content only as needed to operate the feature you use and support the service.",
        ],
    },
    {
        id: "service-availability",
        title: "Service Availability",
        body: [
            "Covered properties are provided for portfolio, personal, experimental, and application purposes. Features may be updated, restricted, suspended, or discontinued at any time.",
            "Reasonable effort may be made to keep services available and reliable, but continuous access, error-free operation, and preservation of all data are not guaranteed.",
        ],
    },
    {
        id: "third-party-services",
        title: "Third-Party Services",
        body: [
            "Covered properties may depend on third-party infrastructure, identity providers, storage providers, CDNs, repositories, APIs, or external links. Your use of those services may be subject to their own terms and policies.",
            "The provider is not responsible for third-party content, outages, data handling, security practices, policy changes, or decisions made outside the covered property.",
        ],
    },
    {
        id: "privacy",
        title: "Privacy",
        body: [
            "Use of covered properties is also governed by the Privacy Policy, which explains how information is collected, used, disclosed, retained, and deleted.",
            "For privacy-specific matters, the Privacy Policy controls if there is a conflict between these terms and the Privacy Policy.",
        ],
    },
    {
        id: "disclaimers",
        title: "Disclaimers",
        body: [
            "Covered properties are provided as is and as available. To the fullest extent permitted by law, the provider disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, non-infringement, availability, accuracy, and security.",
            "Portfolio content, code snippets, project notes, and technical examples are provided for informational purposes and may be incomplete, outdated, experimental, or unsuitable for a specific production use.",
        ],
    },
    {
        id: "limitation-of-liability",
        title: "Limitation of Liability",
        body: [
            "To the fullest extent permitted by law, the provider will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, profits, goodwill, business opportunity, or service access arising from or related to a covered property.",
            "Where liability cannot legally be excluded, liability is limited to the smallest amount permitted by applicable law.",
        ],
    },
    {
        id: "changes-to-these-terms",
        title: "Changes to These Terms",
        body: [
            "These terms may be updated when covered properties, application features, service providers, legal requirements, or operating needs change. The effective date identifies the current version.",
            "Continued use of a covered property after updated terms are posted means you accept the updated terms.",
        ],
    },
    {
        id: "contact",
        title: "Contact",
        body: [
            "For questions about these terms, use the contact links published on syn-forge.com. When relevant, include the covered application name and the account email associated with your request.",
        ],
    },
];

export default function TermsAndConditions() {
    const pageRef = useRef<HTMLElement | null>(null);
    const activeSectionIdRef = useRef(termsSections[0].id);
    const [visibleSectionIds, setVisibleSectionIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [activeSectionId, setActiveSectionId] = useState(termsSections[0].id);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const visibleClassNames = useMemo(() => visibleSectionIds, [visibleSectionIds]);
    const activeSectionIndex = Math.max(
        termsSections.findIndex((section) => section.id === activeSectionId),
        0,
    );
    const activeSection = termsSections[activeSectionIndex];

    useEffect(() => {
        activeSectionIdRef.current = activeSectionId;
    }, [activeSectionId]);

    const updateSectionHash = (sectionId: string) => {
        const nextHash = `#${sectionId}`;

        if (window.location.hash !== nextHash) {
            window.history.replaceState(null, "", nextHash);
        }
    };

    const handleSectionJump = (sectionId: string) => {
        document.getElementById(sectionId)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
        updateSectionHash(sectionId);
        setQuickActionsOpen(false);
    };

    const handleBackToTop = () => {
        pageRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
        setQuickActionsOpen(false);
    };

    useEffect(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

        if (reduceMotion.matches) {
            setVisibleSectionIds(new Set(termsSections.map((section) => section.id)));
        }

        const handleScroll = () => {
            const offset = Math.min(window.scrollY * 0.12, 90);
            const page = pageRef.current;

            pageRef.current?.style.setProperty("--policy-parallax", `${offset}px`);

            if (!page) return;

            const rect = page.getBoundingClientRect();
            const scrollableDistance = Math.max(
                page.offsetHeight - window.innerHeight,
                1,
            );
            const progressed = Math.min(
                Math.max((Math.abs(Math.min(rect.top, 0)) / scrollableDistance) * 100, 0),
                100,
            );

            setScrollProgress(progressed);
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const elements = termsSections
            .map((section) => document.getElementById(section.id))
            .filter((element): element is HTMLElement => Boolean(element));

        if (!elements.length) return;

        const revealObserver = new IntersectionObserver(
            (entries) => {
                setVisibleSectionIds((current) => {
                    const next = new Set(current);

                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            next.add(entry.target.id);
                        } else {
                            next.delete(entry.target.id);
                        }
                    });

                    return next;
                });
            },
            {
                rootMargin: "0px 0px -12% 0px",
                threshold: 0.08,
            },
        );

        const activeObserver = new IntersectionObserver(
            (entries) => {
                const visibleEntries = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

                if (visibleEntries[0]?.target.id) {
                    const nextActiveSectionId = visibleEntries[0].target.id;

                    if (activeSectionIdRef.current !== nextActiveSectionId) {
                        activeSectionIdRef.current = nextActiveSectionId;
                        setActiveSectionId(nextActiveSectionId);
                        updateSectionHash(nextActiveSectionId);
                    }
                }
            },
            {
                rootMargin: "-20% 0px -55% 0px",
                threshold: [0.12, 0.32, 0.58],
            },
        );

        elements.forEach((element) => {
            revealObserver.observe(element);
            activeObserver.observe(element);
        });

        return () => {
            revealObserver.disconnect();
            activeObserver.disconnect();
        };
    }, []);

    return (
        <>
            <GlobalHeadManager
                title="Terms and Conditions"
                description="Terms and Conditions for Syn-Forge, Operator-Syn, and related personal applications hosted under syn-forge.com."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/terms-and-conditions"
            />

            <CookingArea>
                <main className="privacy-policy-page container py-3" ref={pageRef}>
                    <header className="privacy-policy-hero">
                        <div className="privacy-policy-hero-copy">
                            <p className="privacy-policy-kicker">Syn-Forge applications</p>
                            <h1>Terms and Conditions</h1>
                            <p className="privacy-policy-summary">
                                These terms define the rules for using syn-forge.com, Operator-Syn, and related Syn-Forge applications that link to this page.
                            </p>
                            <p className="privacy-policy-summary">
                                Covered applications generally run on syn-forge.com or a subdomain of syn-forge.com, unless a specific application provides separate terms.
                            </p>
                            <p className="privacy-policy-updated">Effective date: June 16, 2026</p>
                        </div>

                        <dl className="privacy-policy-summary-grid">
                            {termsSummary.map((item, index) => (
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

                    <article className="privacy-policy-document">
                        {termsSections.map((section, index) => (
                            <section
                                className={`privacy-policy-section ${visibleClassNames.has(section.id) ? "is-visible" : ""}`}
                                id={section.id}
                                key={section.id}
                                style={{ "--section-delay": `${Math.min(index, 3) * 35}ms` } as CSSProperties}
                            >
                                <div className="privacy-policy-section-heading">
                                    <span className="privacy-policy-section-number">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    <h2>
                                        <a href={`#${section.id}`}>{section.title}</a>
                                    </h2>
                                </div>
                                {section.body.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                                {section.items && (
                                    <ul>
                                        {section.items.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </article>

                    <div
                        className={`privacy-policy-quick-actions ${quickActionsOpen ? "is-open" : ""}`}
                        style={{ "--policy-progress": `${scrollProgress}%` } as CSSProperties}
                    >
                        <div className="privacy-policy-action-panel" aria-hidden={!quickActionsOpen}>
                            <div className="privacy-policy-action-header">
                                <div>
                                    <span>Current section</span>
                                    <strong>{activeSection.title}</strong>
                                </div>
                                <button
                                    aria-label="Close section navigator"
                                    className="privacy-policy-icon-button"
                                    onClick={() => setQuickActionsOpen(false)}
                                    title="Close"
                                    type="button"
                                >
                                    <X aria-hidden="true" size={18} />
                                </button>
                            </div>

                            <div className="privacy-policy-action-progress" aria-hidden="true">
                                <span />
                            </div>

                            <div className="privacy-policy-action-shortcuts">
                                <button onClick={handleBackToTop} type="button">
                                    <ArrowUp aria-hidden="true" size={16} />
                                    Top
                                </button>
                            </div>

                            <nav aria-label="Terms and conditions sections" className="privacy-policy-action-list">
                                {termsSections.map((section, index) => (
                                    <button
                                        className={section.id === activeSectionId ? "active" : ""}
                                        key={section.id}
                                        onClick={() => handleSectionJump(section.id)}
                                        type="button"
                                    >
                                        <span>{String(index + 1).padStart(2, "0")}</span>
                                        {section.title}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        <button
                            aria-expanded={quickActionsOpen}
                            aria-label="Open section navigator"
                            className="privacy-policy-action-trigger"
                            onClick={() => setQuickActionsOpen((open) => !open)}
                            title="Sections"
                            type="button"
                        >
                            <span className="privacy-policy-action-ring">
                                <span>{String(activeSectionIndex + 1).padStart(2, "0")}</span>
                            </span>
                            <ListTree aria-hidden="true" size={20} />
                        </button>
                    </div>
                </main>
            </CookingArea>
        </>
    );
}
