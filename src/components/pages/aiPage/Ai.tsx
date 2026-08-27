import { ArrowUpRight, Bot, Braces, FileText, FolderCode, ShieldCheck } from "lucide-react";
import {
  PORTFOLIO_MCP_CLIENT_CONFIG,
  PORTFOLIO_MCP_DESCRIPTION,
  PORTFOLIO_MCP_ENDPOINT,
  PORTFOLIO_MCP_RESOURCES,
  PORTFOLIO_MCP_SERVER_NAME,
  PORTFOLIO_MCP_TOOLS,
} from "../../../data/portfolioMcp";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import TransitionNavLink from "../../pageTransition/TransitionNavLink";
import "./Ai.css";

const AI_PAGE_URL = "https://syn-forge.com/ai";

export default function Ai() {
  return (
    <>
      <GlobalHeadManager
        description={PORTFOLIO_MCP_DESCRIPTION}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          description: PORTFOLIO_MCP_DESCRIPTION,
          name: "AI and MCP Access",
          url: AI_PAGE_URL,
          about: {
            "@type": "SoftwareApplication",
            applicationCategory: "DeveloperApplication",
            name: "Syn-Forge Portfolio MCP",
            url: PORTFOLIO_MCP_ENDPOINT,
          },
        }}
        title="AI and MCP Access"
        url={AI_PAGE_URL}
      />

      <main aria-labelledby="ai-page-title" className="ai-page">
        <header className="ai-page-hero">
          <div className="ai-page-hero-copy">
            <p className="ai-page-kicker">Public agent interface</p>
            <h1 id="ai-page-title">Portfolio, readable by agents.</h1>
            <p className="ai-page-lede">
              {PORTFOLIO_MCP_DESCRIPTION} It is read-only and designed to give agents a direct,
              source-grounded way to understand this portfolio.
            </p>
            <div className="ai-page-actions">
              <a className="ai-page-button" href={PORTFOLIO_MCP_ENDPOINT} rel="noreferrer">
                Connect to MCP <ArrowUpRight aria-hidden="true" size={16} />
              </a>
              <a className="ai-page-button ai-page-button-secondary" href="/llms.txt">
                Read llms.txt <FileText aria-hidden="true" size={16} />
              </a>
            </div>
          </div>

          <div className="ai-page-hero-mark" aria-hidden="true">
            <Bot size={88} strokeWidth={1} />
            <span>READ / ONLY</span>
          </div>
        </header>

        <section className="ai-page-panel" aria-labelledby="ai-connection-title">
          <div className="ai-page-section-heading">
            <p className="ai-page-kicker">01 / Connect</p>
            <h2 id="ai-connection-title">Use the remote server URL</h2>
          </div>
          <p>
            Add the endpoint to an MCP-capable agent or client. No account or OAuth flow is required
            for the current public read-only surface.
          </p>
          <p className="ai-page-server-name">Server name: {PORTFOLIO_MCP_SERVER_NAME}</p>
          <code className="ai-page-endpoint">{PORTFOLIO_MCP_ENDPOINT}</code>
          <pre className="ai-page-config">
            <code>{JSON.stringify(PORTFOLIO_MCP_CLIENT_CONFIG, null, 2)}</code>
          </pre>
        </section>

        <div className="ai-page-grid">
          <section className="ai-page-panel" aria-labelledby="ai-tools-title">
            <div className="ai-page-section-heading">
              <p className="ai-page-kicker">02 / Tools</p>
              <h2 id="ai-tools-title">Ask for portfolio evidence</h2>
            </div>
            <ul className="ai-page-contract-list">
              {PORTFOLIO_MCP_TOOLS.map(([name, description]) => (
                <li key={name}>
                  <Braces aria-hidden="true" size={16} />
                  <span>
                    <strong>{name}</strong>
                    <small>{description}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ai-page-panel" aria-labelledby="ai-resources-title">
            <div className="ai-page-section-heading">
              <p className="ai-page-kicker">03 / Resources</p>
              <h2 id="ai-resources-title">Stable context for retrieval</h2>
            </div>
            <ul className="ai-page-contract-list">
              {PORTFOLIO_MCP_RESOURCES.map(([uri, description]) => (
                <li key={uri}>
                  <FolderCode aria-hidden="true" size={16} />
                  <span>
                    <strong>{uri}</strong>
                    <small>{description}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="ai-page-panel ai-page-boundary" aria-labelledby="ai-boundary-title">
          <div className="ai-page-section-heading">
            <p className="ai-page-kicker">04 / Boundary</p>
            <h2 id="ai-boundary-title">Grounded, public, and bounded</h2>
          </div>
          <div className="ai-page-boundary-copy">
            <p>
              The server exposes public portfolio content through the existing read API. It does not
              expose administration, authentication, database access, or write operations.
            </p>
            <p>
              Agents should cite the canonical pages when summarizing information and label any
              conclusion that goes beyond the published portfolio as inference.
            </p>
          </div>
          <div className="ai-page-related-links">
            <TransitionNavLink to="/projects">Projects</TransitionNavLink>
            <TransitionNavLink to="/certificates">Certificates</TransitionNavLink>
            <TransitionNavLink to="/snippets">Snippets</TransitionNavLink>
            <TransitionNavLink to="/privacy-policy">
              Privacy <ShieldCheck aria-hidden="true" size={15} />
            </TransitionNavLink>
          </div>
        </section>
      </main>
    </>
  );
}
