import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowUp, Home, ListTree, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import "./PrivacyPolicy.css";

type PolicySummaryItem = {
    label: string;
    value: string;
};

type PolicySection = {
    id: string;
    title: string;
    body: string[];
    items?: string[];
};

type PolicyRouteState = {
    returnLabel?: string;
    returnTo?: string;
};

const getReturnContext = (state: unknown) => {
    const routeState = state as PolicyRouteState | null;
    const returnTo = routeState?.returnTo;

    if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
        return null;
    }

    return {
        label: routeState?.returnLabel || "previous page",
        to: returnTo,
    };
};

const policySummary: PolicySummaryItem[] = [
    {
        label: "Controller",
        value: "Syn-Forge and Operator-Syn, operated by John-Ronan S. Beira",
    },
    {
        label: "Coverage",
        value: "syn-forge.com and applications served from its subdomains",
    },
    {
        label: "Purpose",
        value: "Portfolio publishing, application access, administration, and user-selected features",
    },
    {
        label: "Google API data",
        value: "Used only for sign-in, authorization, security, and visible user-facing features",
    },
];

const policySections: PolicySection[] = [
    {
        id: "scope-and-covered-properties",
        title: "Scope and Covered Properties",
        body: [
            "This Privacy Policy applies to syn-forge.com, Operator-Syn, and applications operated by the same controller that link to this policy.",
            "A covered property is generally identifiable by its domain. Pages and applications served from syn-forge.com or a subdomain of syn-forge.com are intended to be covered by this policy, unless a different privacy notice is provided for that application.",
            "This policy does not apply to third-party websites, platforms, identity providers, repositories, payment pages, or social networks that are not operated by the controller, even when they are linked from a covered property.",
        ],
    },
    {
        id: "information-processed-by-the-portfolio-site",
        title: "Information Processed by the Portfolio Site",
        body: [
            "The public portfolio is primarily an informational website. It does not currently provide public account registration, checkout, newsletter signup, interest-based advertising, or third-party analytics controlled by this site.",
            "The portfolio displays public content such as profile details, projects, certificates, images, and snippets from Cloudflare-backed APIs, database records, and object storage.",
        ],
        items: [
            "Technical request data may be processed by hosting, CDN, and security providers. This can include IP address, user agent, requested URL, referrer, timestamp, and similar request metadata.",
            "Public content records are maintained for presentation on the site and may include portfolio text, project metadata, certificate metadata, media URLs, and snippet content.",
            "Private administration endpoints may use an authentication cookie named auth_token to confirm access to protected management features.",
        ],
    },
    {
        id: "google-sign-in-and-oauth-data",
        title: "Google Sign-In and OAuth Data",
        body: [
            "Some covered applications may offer Google Sign-In or Google OAuth authorization. For sign-in-only use, the application receives the basic account information authorized on the Google consent screen, such as Google account ID, name, email address, and profile image.",
            "Google account information is used to identify the signed-in user, create or maintain an application session, authorize access, protect private features, and prevent unauthorized use.",
            "If a covered application requests additional Google API scopes, those scopes should be requested only for a visible feature selected by the user. The Google consent screen and any relevant in-product notice should describe the requested access before authorization.",
        ],
        items: [
            "Google user data is not sold.",
            "Google user data is not used for advertising, retargeting, or unrelated marketing profiles.",
            "Google user data is not transferred to data brokers, advertising platforms, or information resellers.",
            "Google user data is not used to determine credit, lending, employment, housing, or insurance eligibility.",
            "Google user data is not used to train general artificial-intelligence or machine-learning models.",
        ],
    },
    {
        id: "use-of-information",
        title: "Use of Information",
        body: [
            "Information is used only for purposes reasonably necessary to operate, secure, maintain, and improve the covered property or the user-facing feature selected by the user.",
        ],
        items: [
            "Providing requested pages, files, and application features.",
            "Authenticating users and authorizing access to protected features.",
            "Storing content, settings, or records intentionally submitted through a covered application.",
            "Diagnosing errors, maintaining reliability, and improving application behavior.",
            "Detecting abuse, protecting systems, and investigating unauthorized access.",
            "Complying with applicable legal obligations or enforceable requests.",
        ],
    },
    {
        id: "cookies-and-browser-storage",
        title: "Cookies and Browser Storage",
        body: [
            "Covered applications may use cookies or browser storage when necessary for login state, security, routing, preferences, or normal application behavior.",
            "This policy does not govern cookies, browser storage, or tracking technologies controlled by third-party websites after a user leaves a covered property.",
        ],
    },
    {
        id: "service-providers-and-infrastructure",
        title: "Service Providers and Infrastructure",
        body: [
            "Covered properties rely on infrastructure providers to host, secure, store, and deliver the site and applications. These providers process information only as needed to provide their services, maintain security, and support normal operation.",
        ],
        items: [
            "Cloudflare may process request data, logs, database records, object-storage files, and security events for Pages, Workers, D1, R2, CDN, routing, and security services.",
            "Google may process authentication and authorization data when a user chooses Google Sign-In or grants access through Google OAuth.",
            "Additional app-specific providers may be used when necessary for a feature in a covered application.",
        ],
    },
    {
        id: "disclosure-of-information",
        title: "Disclosure of Information",
        body: [
            "Personal information is not sold. Information is disclosed only in the limited circumstances described below.",
        ],
        items: [
            "To service providers that host, authenticate, store, secure, log, or deliver the covered property.",
            "To comply with applicable law, legal process, or an enforceable government request.",
            "To investigate security incidents, abuse, fraud, or unauthorized access.",
            "When the user intentionally directs a covered application to publish, send, or share information.",
        ],
    },
    {
        id: "retention",
        title: "Retention",
        body: [
            "Information is retained only for as long as reasonably necessary for the purpose for which it was collected, unless a longer period is required for security, backup integrity, dispute resolution, fraud prevention, or legal compliance.",
            "Authentication sessions may expire, be revoked, or be deleted when no longer needed. Server and CDN logs follow the retention settings of the relevant infrastructure provider or deployment environment.",
        ],
    },
    {
        id: "access-and-deletion-requests",
        title: "Access and Deletion Requests",
        body: [
            "Users may request access to or deletion of account-related information associated with a covered application. Requests should include the application name and the email address or account identifier used to sign in.",
            "Some information may be retained when deletion is not technically feasible or when retention is necessary for security, legal compliance, fraud prevention, dispute resolution, or backup integrity. If a request cannot be completed in full, the limitation will be explained where appropriate.",
        ],
    },
    {
        id: "security",
        title: "Security",
        body: [
            "Reasonable safeguards are used for a personal portfolio and small application environment, including HTTPS, provider-managed infrastructure controls, access restrictions, and separation between public and private API endpoints.",
            "No internet service can guarantee absolute security. If a security issue materially affects personal information, reasonable steps will be taken to investigate, remediate, and notify affected users when required.",
        ],
    },
    {
        id: "children",
        title: "Children",
        body: [
            "Covered properties are not directed to children under 13, and personal information is not knowingly collected from children under 13.",
            "If a parent or guardian believes that a child provided personal information to a covered application, they may request review and deletion of that information.",
        ],
    },
    {
        id: "google-api-services-user-data-policy",
        title: "Google API Services User Data Policy",
        body: [
            "Use and transfer of information received from Google APIs by covered applications will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
            "Covered applications request the minimum Google permissions needed for the feature selected by the user. If an optional permission is denied, the related feature may be unavailable or limited.",
        ],
    },
    {
        id: "changes-to-this-policy",
        title: "Changes to This Policy",
        body: [
            "This policy may be updated when covered properties, application features, service providers, or legal requirements change. The effective date identifies the current version.",
            "If a covered application materially changes how it uses Google user data, the application should request consent before using that data for a new purpose.",
        ],
    },
    {
        id: "contact",
        title: "Contact",
        body: [
            "For privacy questions, access requests, or deletion requests, use the contact links published on syn-forge.com. Include the covered application name and the account email related to the request.",
        ],
    },
];

export default function PrivacyPolicy() {
    const location = useLocation();
    const navigate = useNavigate();
    const pageRef = useRef<HTMLElement | null>(null);
    const activeSectionIdRef = useRef(policySections[0].id);
    const [visibleSectionIds, setVisibleSectionIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [activeSectionId, setActiveSectionId] = useState(policySections[0].id);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const visibleClassNames = useMemo(() => visibleSectionIds, [visibleSectionIds]);
    const activeSectionIndex = Math.max(
        policySections.findIndex((section) => section.id === activeSectionId),
        0,
    );
    const activeSection = policySections[activeSectionIndex];
    const returnContext = getReturnContext(location.state);

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

    const handleBackToHome = () => {
        navigate("/");
        setQuickActionsOpen(false);
    };

    const handleReturnToSource = () => {
        if (!returnContext) return;

        navigate(returnContext.to);
        setQuickActionsOpen(false);
    };

    useEffect(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

        if (reduceMotion.matches) {
            setVisibleSectionIds(new Set(policySections.map((section) => section.id)));
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
        const elements = policySections
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

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: "https://syn-forge.com/",
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Privacy Policy",
                item: "https://syn-forge.com/privacy-policy",
            },
        ],
    };

    return (
        <>
            <GlobalHeadManager
                title="Privacy Policy"
                description="Privacy Policy for Syn-Forge, Operator-Syn, and related personal applications hosted under syn-forge.com."
                image="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png"
                url="https://syn-forge.com/privacy-policy"
                jsonLd={breadcrumbSchema}
            />

            <CookingArea>
                <main className="privacy-policy-page container py-3" ref={pageRef}>
                    {returnContext && (
                        <button
                            className="privacy-policy-context-return"
                            onClick={handleReturnToSource}
                            title={`Back to ${returnContext.label}`}
                            type="button"
                        >
                            <ArrowLeft aria-hidden="true" size={16} />
                            Back to {returnContext.label}
                        </button>
                    )}

                    <header className="privacy-policy-hero">
                        <div className="privacy-policy-hero-copy">
                            <p className="privacy-policy-kicker">Syn-Forge applications</p>
                            <h1>Privacy Policy</h1>
                            <p className="privacy-policy-summary">
                                This policy explains how information is handled across syn-forge.com, Operator-Syn, and personal applications that link to this page.
                            </p>
                            <p className="privacy-policy-summary">
                                A covered application is generally identifiable by its domain: syn-forge.com or a subdomain of syn-forge.com, unless that application provides a different notice.
                            </p>
                            <p className="privacy-policy-updated">Effective date: June 15, 2026</p>
                        </div>

                        <dl className="privacy-policy-summary-grid">
                            {policySummary.map((item, index) => (
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
                        {policySections.map((section, index) => (
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
                                <button
                                    aria-label="Back to Home"
                                    onClick={handleBackToHome}
                                    title="Back to Home"
                                    type="button"
                                >
                                    <Home aria-hidden="true" size={16} />
                                    Home
                                </button>
                                {returnContext && (
                                    <button onClick={handleReturnToSource} type="button">
                                        <ArrowLeft aria-hidden="true" size={16} />
                                        Back to {returnContext.label}
                                    </button>
                                )}
                            </div>

                            <nav aria-label="Privacy policy sections" className="privacy-policy-action-list">
                                {policySections.map((section, index) => (
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
