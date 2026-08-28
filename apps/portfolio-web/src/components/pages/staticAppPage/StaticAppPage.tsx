import { FileText, type LucideIcon, ShieldCheck } from "lucide-react";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import TransitionNavLink from "../../pageTransition/TransitionNavLink";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
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
      <GlobalHeadManager title={config.title} description={config.description} url={config.url} />

      <CookingArea>
        <main aria-labelledby="static-app-page-title" className="static-app-page">
          <PointerCoordinates className="static-app-coordinates" markerCount={0} />

          <header className="static-app-hero">
            <div className="static-app-hero-copy">
              <p className="static-app-kicker">{config.kicker}</p>
              <h1 id="static-app-page-title">{config.heading}</h1>
              <div className="static-app-hero-body">
                {config.heroParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="static-app-hero-actions">
                <TransitionNavLink
                  className="static-app-link-button"
                  state={policyRouteState}
                  to="/privacy-policy"
                >
                  <ShieldCheck aria-hidden="true" size={17} />
                  Privacy Policy
                </TransitionNavLink>
                <TransitionNavLink
                  className="static-app-link-button secondary"
                  state={policyRouteState}
                  to="/terms-and-conditions"
                >
                  <FileText aria-hidden="true" size={17} />
                  Terms
                </TransitionNavLink>
              </div>
            </div>

            <dl className="static-app-summary-grid">
              {config.summaryItems.map((item) => (
                <div className="static-app-summary-item" key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <article className="static-app-document">
            {config.sections.map((section, index) => {
              const Icon = section.icon;

              return (
                <section className="static-app-section" key={section.title}>
                  <div aria-hidden="true" className="static-app-section-mark">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Icon size={18} />
                  </div>

                  <div className="static-app-section-content">
                    <div className="static-app-section-heading">
                      <p className="static-app-section-kicker">Application note</p>
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
                        <TransitionNavLink state={policyRouteState} to="/privacy-policy">
                          <ShieldCheck aria-hidden="true" size={17} />
                          Read the Privacy Policy
                        </TransitionNavLink>
                        <TransitionNavLink state={policyRouteState} to="/terms-and-conditions">
                          <FileText aria-hidden="true" size={17} />
                          Read the Terms and Conditions
                        </TransitionNavLink>
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </article>
        </main>
      </CookingArea>
    </>
  );
}
