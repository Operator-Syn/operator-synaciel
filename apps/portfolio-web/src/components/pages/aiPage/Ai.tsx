import {
  ArrowDown,
  Bot,
  Braces,
  Check,
  Compass,
  Copy,
  FileText,
  FolderCode,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_MCP_CLIENT_CONFIG,
  PORTFOLIO_MCP_DESCRIPTION,
  PORTFOLIO_MCP_ENDPOINT,
  PORTFOLIO_MCP_ONBOARDING_PROMPT,
  PORTFOLIO_MCP_RESOURCES,
  PORTFOLIO_MCP_SERVER_NAME,
  PORTFOLIO_MCP_TOOLS,
  PORTFOLIO_MCP_TRANSPORT,
} from "../../../data/portfolioMcp";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import TransitionNavLink from "../../pageTransition/TransitionNavLink";
import "./Ai.css";

const AI_PAGE_URL = "https://syn-forge.com/ai";

type PromptCopyState = "idle" | "copied" | "error";

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Clipboard access is unavailable");
  }
}

export default function Ai() {
  const [promptCopyState, setPromptCopyState] = useState<PromptCopyState>("idle");
  const promptResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (promptResetTimerRef.current !== null) {
        window.clearTimeout(promptResetTimerRef.current);
      }
    };
  }, []);

  const handleCopyPrompt = async () => {
    if (promptResetTimerRef.current !== null) {
      window.clearTimeout(promptResetTimerRef.current);
      promptResetTimerRef.current = null;
    }

    try {
      await copyText(PORTFOLIO_MCP_ONBOARDING_PROMPT);
      setPromptCopyState("copied");
      promptResetTimerRef.current = window.setTimeout(() => {
        setPromptCopyState("idle");
        promptResetTimerRef.current = null;
      }, 2200);
    } catch {
      setPromptCopyState("error");
    }
  };

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
            name: "Syn-Forge Public Portfolio MCP",
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
              {PORTFOLIO_MCP_DESCRIPTION} Start with a ready-to-paste request, then inspect the
              server contract and the evidence it can return.
            </p>
            <div className="ai-page-actions">
              <a aria-controls="ai-onboarding" className="ai-page-button" href="#ai-onboarding">
                Connect to MCP <ArrowDown aria-hidden="true" size={16} />
              </a>
              <a
                className="ai-page-button ai-page-button-secondary"
                href="/llms.txt"
                data-transition-preserve-state="true"
              >
                Read llms.txt <FileText aria-hidden="true" size={16} />
              </a>
            </div>
          </div>

          <aside
            aria-label="Public read-only MCP with no authentication required"
            className="ai-page-hero-mark"
          >
            <Bot aria-hidden="true" size={88} strokeWidth={1} />
            <div className="ai-page-hero-mark-copy">
              <strong>READ / ONLY</strong>
              <span>PUBLIC / NO AUTH</span>
            </div>
          </aside>
        </header>

        <section
          aria-labelledby="ai-onboarding-title"
          className="ai-page-panel ai-page-onboarding"
          id="ai-onboarding"
        >
          <div className="ai-page-section-heading">
            <p className="ai-page-kicker">01 / Quick start</p>
            <h2 id="ai-onboarding-title">Give your agent the setup request</h2>
            <p className="ai-page-section-intro">
              Paste this prompt into an MCP-capable agent or client. It asks for registration,
              verification, and nothing beyond the public read-only boundary.
            </p>
          </div>

          <div className="ai-page-onboarding-grid">
            <div className="ai-page-onboarding-copy">
              <p>
                The prompt names the endpoint and transport so your agent can use its normal MCP
                configuration flow without guessing at credentials or installation steps.
              </p>
              <ol className="ai-page-step-list">
                <li>
                  <span className="ai-page-step-number">01</span>
                  <span>
                    <strong>Copy</strong>
                    <small>Copy the request exactly as written.</small>
                  </span>
                </li>
                <li>
                  <span className="ai-page-step-number">02</span>
                  <span>
                    <strong>Paste</strong>
                    <small>Send it to the agent or client you want to configure.</small>
                  </span>
                </li>
                <li>
                  <span className="ai-page-step-number">03</span>
                  <span>
                    <strong>Verify</strong>
                    <small>Ask the agent to confirm the server appears in its tools list.</small>
                  </span>
                </li>
              </ol>
            </div>

            <div className="ai-page-prompt-shell">
              <div className="ai-page-prompt-header">
                <span className="ai-page-code-label">Agent prompt / text</span>
                <button
                  aria-label="Copy MCP registration prompt"
                  className="ai-page-copy-button"
                  data-copy-state={promptCopyState}
                  data-cursor="copy"
                  onClick={() => void handleCopyPrompt()}
                  type="button"
                >
                  {promptCopyState === "copied" ? (
                    <Check aria-hidden="true" size={15} />
                  ) : (
                    <Copy aria-hidden="true" size={15} />
                  )}
                  {promptCopyState === "copied" ? "Copied" : "Copy prompt"}
                </button>
              </div>
              <pre className="ai-page-prompt">
                <code>{PORTFOLIO_MCP_ONBOARDING_PROMPT}</code>
              </pre>
              <output aria-live="polite" className="ai-page-copy-status">
                {promptCopyState === "copied"
                  ? "Prompt copied to clipboard."
                  : promptCopyState === "error"
                    ? "Copy unavailable. Select the prompt manually."
                    : "Ready to paste into your agent."}
              </output>
            </div>
          </div>
        </section>

        <section className="ai-page-panel" aria-labelledby="ai-connection-title">
          <div className="ai-page-section-heading">
            <p className="ai-page-kicker">02 / Server contract</p>
            <h2 id="ai-connection-title">Connect over one public endpoint</h2>
          </div>

          <div className="ai-page-contract-layout">
            <div>
              <p className="ai-page-section-intro">
                These are the stable details your agent needs to register this server. No account,
                OAuth flow, or client-specific package is required for the public surface.
              </p>
              <dl className="ai-page-facts">
                <div>
                  <dt>Server name</dt>
                  <dd>
                    <code>{PORTFOLIO_MCP_SERVER_NAME}</code>
                  </dd>
                </div>
                <div>
                  <dt>Transport</dt>
                  <dd>{PORTFOLIO_MCP_TRANSPORT}</dd>
                </div>
                <div>
                  <dt>Authentication</dt>
                  <dd>None</dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>Read-only</dd>
                </div>
                <div>
                  <dt>Endpoint</dt>
                  <dd>
                    <code>{PORTFOLIO_MCP_ENDPOINT}</code>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="ai-page-config-shell">
              <div className="ai-page-code-label">Client config / JSON</div>
              <pre className="ai-page-config">
                <code>{JSON.stringify(PORTFOLIO_MCP_CLIENT_CONFIG, null, 2)}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="ai-page-panel ai-page-evidence" aria-labelledby="ai-tools-title">
          <div className="ai-page-section-heading">
            <p className="ai-page-kicker">03 / Evidence map</p>
            <h2 id="ai-tools-title">Ask for specific portfolio evidence</h2>
            <p className="ai-page-section-intro">
              Tools handle targeted questions. Resources provide stable collections for broader
              context.
            </p>
          </div>

          <div className="ai-page-evidence-grid">
            <div className="ai-page-contract-group">
              <div className="ai-page-group-heading">
                <Braces aria-hidden="true" size={18} />
                <h3>Tools</h3>
              </div>
              <ul className="ai-page-contract-list">
                {PORTFOLIO_MCP_TOOLS.map(([name, description]) => (
                  <li key={name}>
                    <span className="ai-page-contract-mark" aria-hidden="true">
                      <Braces size={14} />
                    </span>
                    <span>
                      <strong>{name}</strong>
                      <small>{description}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ai-page-contract-group">
              <div className="ai-page-group-heading">
                <Compass aria-hidden="true" size={18} />
                <h3>Resources</h3>
              </div>
              <ul className="ai-page-contract-list">
                {PORTFOLIO_MCP_RESOURCES.map(([uri, description]) => (
                  <li key={uri}>
                    <span className="ai-page-contract-mark" aria-hidden="true">
                      <FolderCode size={14} />
                    </span>
                    <span>
                      <strong>{uri}</strong>
                      <small>{description}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="ai-page-panel ai-page-boundary" aria-labelledby="ai-boundary-title">
          <div className="ai-page-section-heading">
            <p className="ai-page-kicker">04 / Public boundary</p>
            <h2 id="ai-boundary-title">Grounded, public, and bounded</h2>
          </div>
          <div className="ai-page-boundary-grid">
            <div className="ai-page-boundary-item">
              <h3>Available</h3>
              <p>
                Public profile, project, certificate, and snippet information from the existing read
                API.
              </p>
            </div>
            <div className="ai-page-boundary-item">
              <h3>Not available</h3>
              <p>
                Administration, authentication, database access, and write operations are outside
                this server.
              </p>
            </div>
          </div>
          <p className="ai-page-boundary-note">
            Cite the canonical portfolio pages when summarizing evidence and label conclusions that
            go beyond published material as inference.
          </p>
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
