import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import type { UIMessage } from "ai";
import {
  Download,
  LogIn,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  Component,
  type FormEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  type AssistantThread,
  createThread,
  deleteThread,
  exportThread,
  getSession,
  issueAgentToken,
  listThreads,
  type PublicSession,
  signInUrl,
  signOut,
  verifyTurnstile,
} from "./portfolioAssistantApi.ts";
import { portfolioAssistantAvailability } from "./portfolioAssistantAvailability.ts";
import { portfolioAssistantConfig } from "./portfolioAssistantConfig.ts";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          theme: "dark";
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

const { agentOrigin, turnstileSiteKey } = portfolioAssistantConfig;
const AGENT_QUERY_CACHE_TTL_MS = 4 * 60 * 1_000;

function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => {
      const candidate = part as unknown as Record<string, unknown>;
      return typeof candidate.text === "string" ? candidate.text : "";
    })
    .join("");
}

function messageData(message: UIMessage, type: string): Record<string, unknown> | null {
  for (const part of message.parts) {
    const candidate = part as unknown as Record<string, unknown>;
    if (
      candidate.type === type &&
      candidate.data &&
      typeof candidate.data === "object" &&
      !Array.isArray(candidate.data)
    ) {
      return candidate.data as Record<string, unknown>;
    }
  }
  return null;
}

function TurnstileGate({ onVerified }: { onVerified: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!turnstileSiteKey) {
      setError("Turnstile is not configured for this build yet.");
      return;
    }
    const scriptId = "portfolio-turnstile-script";
    const existing = document.getElementById(scriptId);
    const script =
      existing instanceof HTMLScriptElement ? existing : document.createElement("script");
    if (!existing) {
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const handleLoad = () => setReady(true);
    script.addEventListener("load", handleLoad);
    if (window.turnstile) setReady(true);
    return () => script.removeEventListener("load", handleLoad);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !turnstileSiteKey || !window.turnstile) return;
    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: turnstileSiteKey,
      theme: "dark",
      callback: (token) => {
        void verifyTurnstile(token)
          .then(onVerified)
          .catch((verificationError: unknown) => {
            setError(
              verificationError instanceof Error
                ? verificationError.message
                : "Bot verification failed.",
            );
          });
      },
      "expired-callback": () => setError("The bot check expired. Please try again."),
      "error-callback": () => setError("The bot check could not load. Please try again."),
    });
    return () => {
      if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
    };
  }, [onVerified, ready]);

  return (
    <div className="portfolio-assistant-turnstile">
      <p className="eyebrow">One-time access check</p>
      <p className="portfolio-assistant-muted">
        Complete the Cloudflare check once per session before opening the assistant.
      </p>
      {turnstileSiteKey ? <div ref={containerRef} /> : null}
      {error ? <p className="portfolio-assistant-error">{error}</p> : null}
    </div>
  );
}

function AssistantComingSoon() {
  return (
    <div className="portfolio-assistant-coming-soon">
      <MessageCircle aria-hidden="true" size={28} />
      <p className="eyebrow">In development</p>
      <h3>Portfolio assistant coming soon.</h3>
      <p>
        We’re tuning a source-grounded guide to the work in this portfolio. It will answer with
        evidence from the archive and decline unrelated requests.
      </p>
      <p className="portfolio-assistant-muted">
        The assistant is being tested privately before it becomes part of the public release.
      </p>
    </div>
  );
}

type AssistantChatErrorBoundaryProps = {
  children: ReactNode;
};

type AssistantChatErrorBoundaryState = {
  hasError: boolean;
};

class AssistantChatErrorBoundary extends Component<
  AssistantChatErrorBoundaryProps,
  AssistantChatErrorBoundaryState
> {
  state: AssistantChatErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AssistantChatErrorBoundaryState {
    return { hasError: true };
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="portfolio-assistant-empty-state">
          <p className="portfolio-assistant-error">
            The assistant connection could not be opened. Please try again.
          </p>
          <button className="action-quiet" onClick={this.reset} type="button">
            Retry connection
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AssistantChat({
  threadId,
  onConnectionError,
}: {
  threadId: string;
  onConnectionError: (message: string) => void;
}) {
  const query = useCallback(
    async () => ({ token: (await issueAgentToken(threadId)).token }),
    [threadId],
  );
  const queryDeps = useMemo(() => [threadId], [threadId]);
  const agent = useAgent({
    agent: "PortfolioAgent",
    name: threadId,
    host: agentOrigin ?? "",
    query,
    queryDeps,
    cacheTtl: AGENT_QUERY_CACHE_TTL_MS,
    onConnectionError: (error) => {
      onConnectionError(error.reason || "The assistant connection was closed.");
    },
  });
  const { messages, sendMessage, status, isRecovering } = useAgentChat({
    agent,
    getInitialMessages: null,
  });
  const [draft, setDraft] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || status === "streaming" || isRecovering) return;
    sendMessage({ text: value });
    setDraft("");
  };

  return (
    <div className="portfolio-assistant-chat">
      <div className="portfolio-assistant-message-list" aria-live="polite">
        {messages.length === 0 ? (
          <p className="portfolio-assistant-empty">
            Ask about the work, projects, certificates, snippets, or a linked repository.
          </p>
        ) : (
          messages.map((message) => {
            const text = messageText(message);
            const compaction = messageData(message, "data-compaction");
            return (
              <article className={`portfolio-assistant-message ${message.role}`} key={message.id}>
                <p className="eyebrow">{message.role === "user" ? "You" : "Assistant"}</p>
                {compaction ? (
                  <div className="portfolio-assistant-compaction">
                    <strong>Context compacted</strong>
                    <p>
                      The assistant kept the latest six messages and a bounded summary. Start a new
                      thread whenever you want a clean context.
                    </p>
                  </div>
                ) : null}
                {text ? (
                  message.role === "assistant" ? (
                    <ReactMarkdown>{text}</ReactMarkdown>
                  ) : (
                    <p>{text}</p>
                  )
                ) : null}
              </article>
            );
          })
        )}
      </div>
      <form className="portfolio-assistant-composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="portfolio-assistant-message">
          Portfolio question
        </label>
        <textarea
          id="portfolio-assistant-message"
          maxLength={2_000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a grounded portfolio question..."
          rows={2}
          value={draft}
        />
        <button
          aria-label="Send portfolio question"
          className="portfolio-assistant-send"
          disabled={!draft.trim() || status === "streaming" || isRecovering}
          type="submit"
        >
          <Send aria-hidden="true" size={16} />
        </button>
      </form>
      <output className="portfolio-assistant-status">
        {isRecovering
          ? "Recovering the durable conversation…"
          : status === "streaming"
            ? "Reading portfolio sources…"
            : agent.connectionError
              ? agent.connectionError.reason
              : "Grounded answers include source links."}
      </output>
    </div>
  );
}

function AssistantChatBoundary({
  threadId,
  onConnectionError,
}: {
  threadId: string;
  onConnectionError: (message: string) => void;
}) {
  return (
    <AssistantChatErrorBoundary>
      <Suspense
        fallback={
          <p className="portfolio-assistant-status">Authenticating the assistant connection…</p>
        }
      >
        <AssistantChat onConnectionError={onConnectionError} threadId={threadId} />
      </Suspense>
    </AssistantChatErrorBoundary>
  );
}

function AuthenticatedAssistant({ onLogout }: { onLogout: () => void }) {
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshThreads = useCallback(async () => {
    const result = await listThreads();
    if (result.threads.length === 0) {
      const firstThread = await createThread();
      setThreads([firstThread]);
      setActiveThreadId(firstThread.id);
      return;
    }
    setThreads(result.threads);
    if (!activeThreadId && result.threads[0]) setActiveThreadId(result.threads[0].id);
  }, [activeThreadId]);

  useEffect(() => {
    void refreshThreads().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Threads could not be loaded.");
    });
  }, [refreshThreads]);

  const handleNewThread = async () => {
    try {
      const thread = await createThread();
      setThreads((current) => [thread, ...current]);
      setActiveThreadId(thread.id);
      setError(null);
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "Thread could not be created.");
    }
  };

  const handleDelete = async () => {
    if (!activeThreadId || !window.confirm("Delete this assistant thread?")) return;
    try {
      await deleteThread(activeThreadId);
      const remaining = threads.filter((thread) => thread.id !== activeThreadId);
      setThreads(remaining);
      setActiveThreadId(remaining[0]?.id ?? null);
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Thread could not be deleted.");
    }
  };

  const handleExport = async () => {
    if (!activeThreadId) return;
    try {
      const payload = await exportThread(activeThreadId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `syn-forge-assistant-${activeThreadId}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (exportError: unknown) {
      setError(exportError instanceof Error ? exportError.message : "Export could not be created.");
    }
  };

  const handleLogout = async () => {
    await signOut().catch(() => undefined);
    onLogout();
  };

  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  return (
    <>
      <div className="portfolio-assistant-toolbar">
        <label className="sr-only" htmlFor="portfolio-assistant-thread">
          Assistant thread
        </label>
        <select
          id="portfolio-assistant-thread"
          onChange={(event) => setActiveThreadId(event.target.value)}
          value={activeThreadId ?? ""}
        >
          {!activeThread ? <option value="">New thread</option> : null}
          {threads.map((thread) => (
            <option key={thread.id} value={thread.id}>
              {thread.title ?? `Thread ${thread.id.slice(0, 6)}`}
            </option>
          ))}
        </select>
        <button
          aria-label="New assistant thread"
          className="portfolio-assistant-icon"
          onClick={() => void handleNewThread()}
          type="button"
        >
          <Plus aria-hidden="true" size={15} />
        </button>
        <button
          aria-label="Export assistant thread"
          className="portfolio-assistant-icon"
          disabled={!activeThreadId}
          onClick={() => void handleExport()}
          type="button"
        >
          <Download aria-hidden="true" size={15} />
        </button>
        <button
          aria-label="Delete assistant thread"
          className="portfolio-assistant-icon"
          disabled={!activeThreadId}
          onClick={() => void handleDelete()}
          type="button"
        >
          <Trash2 aria-hidden="true" size={15} />
        </button>
        <button
          aria-label="Sign out of portfolio assistant"
          className="portfolio-assistant-icon"
          onClick={() => void handleLogout()}
          type="button"
        >
          <LogOut aria-hidden="true" size={15} />
        </button>
      </div>
      {error ? <p className="portfolio-assistant-error">{error}</p> : null}
      {activeThreadId ? (
        <AssistantChatBoundary
          key={activeThreadId}
          onConnectionError={setError}
          threadId={activeThreadId}
        />
      ) : (
        <div className="portfolio-assistant-empty-state">
          <p>Start a new thread when you’re ready.</p>
          <button className="action-quiet" onClick={() => void handleNewThread()} type="button">
            <Plus aria-hidden="true" size={15} /> New thread
          </button>
        </div>
      )}
    </>
  );
}

export default function PortfolioAssistantFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const configurationError = portfolioAssistantConfig.configurationError;

  const openAssistant = async () => {
    setIsOpen(true);
    if (portfolioAssistantAvailability === "teaser") {
      setSessionError(null);
      return;
    }
    if (configurationError) {
      setSessionError(configurationError);
      return;
    }
    if (session || loading) return;
    setLoading(true);
    try {
      const result = await getSession();
      setSession(result);
      setSessionError(null);
    } catch (error: unknown) {
      setSession(null);
      setSessionError(error instanceof Error ? error.message : "Sign in to use the assistant.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerified = useCallback(() => {
    setSession((current) => (current ? { ...current, turnstileVerified: true } : current));
  }, []);

  const closeAssistant = () => setIsOpen(false);

  return (
    <div
      className={`portfolio-assistant ${isOpen ? "is-open" : ""}`}
      data-availability={portfolioAssistantAvailability}
    >
      {isOpen ? (
        <section
          aria-label="Portfolio assistant"
          id="portfolio-assistant-panel"
          className="portfolio-assistant-panel"
          data-state="open"
        >
          <header className="portfolio-assistant-header">
            <div>
              <p className="eyebrow">Syn-Forge assistant</p>
              <h2>
                {portfolioAssistantAvailability === "teaser" ? "Coming soon." : "Ask the archive."}
              </h2>
              <p className="portfolio-assistant-muted">
                {portfolioAssistantAvailability === "teaser"
                  ? "A source-grounded portfolio guide is in development."
                  : "Grounded in the portfolio MCP. No general-purpose work."}
              </p>
            </div>
            <button
              aria-label="Close portfolio assistant"
              className="portfolio-assistant-icon"
              onClick={closeAssistant}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </header>
          <div className="portfolio-assistant-body">
            {portfolioAssistantAvailability === "teaser" ? (
              <AssistantComingSoon />
            ) : configurationError ? (
              <div className="portfolio-assistant-sign-in">
                <MessageCircle aria-hidden="true" size={28} />
                <h3>Assistant is not configured for this environment.</h3>
                <p>{configurationError}</p>
              </div>
            ) : loading ? (
              <p className="portfolio-assistant-status">
                <RefreshCw aria-hidden="true" className="portfolio-assistant-spin" size={15} />{" "}
                Checking session…
              </p>
            ) : session?.authenticated ? (
              session.turnstileVerified ? (
                <AuthenticatedAssistant onLogout={() => setSession({ authenticated: false })} />
              ) : (
                <TurnstileGate onVerified={handleVerified} />
              )
            ) : (
              <div className="portfolio-assistant-sign-in">
                <MessageCircle aria-hidden="true" size={28} />
                <h3>Sign in to open the archive.</h3>
                <p>
                  Use Google to receive a bounded, private thread. The assistant only answers with
                  evidence from this portfolio.
                </p>
                <button
                  className="action-primary"
                  onClick={() => window.location.assign(signInUrl(window.location.href))}
                  type="button"
                >
                  <LogIn aria-hidden="true" size={16} /> Continue with Google
                </button>
                {sessionError ? <p className="portfolio-assistant-error">{sessionError}</p> : null}
              </div>
            )}
          </div>
        </section>
      ) : null}
      <button
        aria-controls="portfolio-assistant-panel"
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? "Close portfolio assistant"
            : portfolioAssistantAvailability === "teaser"
              ? "Open portfolio assistant (coming soon)"
              : "Open portfolio assistant"
        }
        className="portfolio-assistant-fab"
        onClick={() => (isOpen ? closeAssistant() : void openAssistant())}
        title={
          portfolioAssistantAvailability === "teaser"
            ? "Portfolio assistant — coming soon"
            : "Portfolio assistant"
        }
        type="button"
      >
        {isOpen ? (
          <X aria-hidden="true" size={20} />
        ) : (
          <MessageCircle aria-hidden="true" size={20} />
        )}
      </button>
    </div>
  );
}
