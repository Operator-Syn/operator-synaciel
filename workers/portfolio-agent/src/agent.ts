import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type ModelMessage,
  stepCountIs,
  streamText,
  type ToolSet,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import {
  type AgentIdentityRow,
  type AgentProps,
  COMPACTION_RETAINED_MESSAGES,
  MAX_MODEL_PASSES,
  MAX_PERSISTED_MESSAGES,
  MAX_QUESTION_CHARS,
  MCP_SERVER_NAME,
  MODEL_ID,
  type PortfolioAgentEnvironment,
  THREAD_BURST_LIMIT,
  THREAD_BURST_WINDOW_MS,
} from "./config.ts";
import {
  asToolSet,
  buildSystemPrompt,
  compactModelMessages,
  filterToolSet,
  findTool,
  hasSearchEvidence,
  isUnsafeQuestion,
  latestUserQuestion,
  McpCallBudget,
  type McpTool,
  requiresGitHubContext,
  summarizeEvidence,
  wrapMcpTools,
} from "./limits.ts";
import { consumeDailyQuota } from "./quota.ts";

function asIdentity(value: AgentIdentityRow | undefined): AgentProps | null {
  if (!value || !value.sub || !value.sid || !value.tid || typeof value.q !== "number") return null;
  return { sub: value.sub, sid: value.sid, tid: value.tid, q: value.q };
}

function sanitizeExportMessage(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  const parts = Array.isArray(message.parts)
    ? message.parts
        .map((part) => {
          if (!part || typeof part !== "object") return null;
          const candidate = part as Record<string, unknown>;
          if (candidate.type === "text" && typeof candidate.text === "string") {
            return { type: "text", text: candidate.text.slice(0, 8_000) };
          }
          if (candidate.type === "data-compaction" || candidate.type === "data-citation") {
            return { type: candidate.type, data: candidate.data ?? null };
          }
          return null;
        })
        .filter((part) => part !== null)
    : [];
  return {
    id: typeof message.id === "string" ? message.id : null,
    role: message.role === "user" || message.role === "assistant" ? message.role : "assistant",
    parts,
    timestamp:
      typeof (message.metadata as Record<string, unknown> | undefined)?.timestamp === "string"
        ? (message.metadata as Record<string, unknown>).timestamp
        : null,
  };
}

export class PortfolioAgent extends AIChatAgent<PortfolioAgentEnvironment, unknown, AgentProps> {
  static options = { sendIdentityOnConnect: false };
  maxPersistedMessages = MAX_PERSISTED_MESSAGES;
  messageConcurrency = "drop" as const;
  waitForMcpConnections = { timeout: 5_000 };
  chatStreamStallTimeoutMs = 60_000;

  private identity: AgentProps | null = null;
  private readonly environment: PortfolioAgentEnvironment;

  constructor(
    ctx: ConstructorParameters<typeof AIChatAgent>[0],
    environment: PortfolioAgentEnvironment,
  ) {
    super(ctx, environment);
    this.environment = environment;
  }

  async onStart(props?: AgentProps): Promise<void> {
    this.sql([
      "CREATE TABLE IF NOT EXISTS portfolio_turn_events (created_at INTEGER NOT NULL)",
    ] as unknown as TemplateStringsArray);
    this.sql([
      "CREATE TABLE IF NOT EXISTS portfolio_agent_identity (sub TEXT NOT NULL, sid TEXT NOT NULL, tid TEXT NOT NULL, q INTEGER NOT NULL)",
    ] as unknown as TemplateStringsArray);
    if (props) {
      this.identity = props;
      this.sql(["DELETE FROM portfolio_agent_identity"] as unknown as TemplateStringsArray);
      this.sql(
        [
          "INSERT INTO portfolio_agent_identity (sub, sid, tid, q) VALUES (",
          ", ",
          ", ",
          ", ",
          ")",
        ] as unknown as TemplateStringsArray,
        props.sub,
        props.sid,
        props.tid,
        props.q,
      );
    }
    const stored = this.sql<AgentIdentityRow>([
      "SELECT sub, sid, tid, q FROM portfolio_agent_identity LIMIT 1",
    ] as unknown as TemplateStringsArray)[0];
    if (!this.identity) this.identity = asIdentity(stored);
    await this.addMcpServer(MCP_SERVER_NAME, this.environment.PORTFOLIO_MCP_URL, {
      transport: { type: "streamable-http" },
      retry: { maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2_000 },
    });
  }

  private threadBurstAvailable(now = Date.now()): boolean {
    this.sql(
      [
        "DELETE FROM portfolio_turn_events WHERE created_at < ",
        "",
      ] as unknown as TemplateStringsArray,
      now - THREAD_BURST_WINDOW_MS,
    );
    const count =
      this.sql<{ count: number }>([
        "SELECT COUNT(*) AS count FROM portfolio_turn_events",
      ] as unknown as TemplateStringsArray)[0]?.count ?? 0;
    if (count >= THREAD_BURST_LIMIT) return false;
    this.sql(
      [
        "INSERT INTO portfolio_turn_events (created_at) VALUES (",
        ")",
      ] as unknown as TemplateStringsArray,
      now,
    );
    return true;
  }

  private staticResponse(message: string): Response {
    const originalMessages = this.messages;
    const stream = createUIMessageStream({
      originalMessages,
      execute: ({ writer }) => {
        const id = crypto.randomUUID();
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: message });
        writer.write({ type: "text-end", id });
        writer.write({ type: "finish", finishReason: "stop" });
        writer.setOutcome({ status: "completed" });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  private limitResponse(message: string): Response {
    return this.staticResponse(
      `${message}\n\nStart a new thread to continue. Your transcript remains available for export.`,
    );
  }

  private async preflight(
    question: string,
    budget: McpCallBudget,
    options?: OnChatMessageOptions,
  ): Promise<{ evidence: unknown; tools: Record<string, McpTool> } | null> {
    const rawTools = this.mcp.getAITools() as Record<string, McpTool>;
    const search = findTool(rawTools, "search_portfolio");
    if (!search || !budget.reserve()) return null;
    try {
      const evidence = await search[1].execute(
        { query: question, limit: 8 },
        { abortSignal: options?.abortSignal },
      );
      if (!hasSearchEvidence(evidence)) return null;
      return { evidence, tools: rawTools };
    } catch {
      return null;
    }
  }

  async onChatMessage(
    _onFinish: Parameters<AIChatAgent<PortfolioAgentEnvironment>["onChatMessage"]>[0],
    options?: OnChatMessageOptions,
  ): Promise<Response> {
    const identity = this.identity;
    const originalMessages = this.messages;
    if (!identity) return this.staticResponse("This assistant session is not authenticated.");
    const question = latestUserQuestion(this.messages);
    if (!question) return this.staticResponse("Please ask a portfolio question.");
    if (question.length > MAX_QUESTION_CHARS) {
      return this.staticResponse("Please keep each portfolio question under 2,000 characters.");
    }
    if (isUnsafeQuestion(question)) {
      return this.staticResponse(
        "I can only help with this portfolio and its linked project evidence.",
      );
    }
    if (!this.threadBurstAvailable()) {
      return this.limitResponse(
        "This thread has reached its short-term allocation of five turns in ten minutes.",
      );
    }
    const quota = await consumeDailyQuota(this.environment.AUTH_DB, identity.sub);
    if (!quota.allowed) {
      if (quota.reason === "daily-limit") {
        return this.limitResponse("Your daily allocation of twenty turns has been reached.");
      }
      if (quota.reason === "paused") {
        return this.staticResponse("The portfolio assistant is temporarily paused.");
      }
      return this.staticResponse("The portfolio assistant is not configured for this session.");
    }

    const budget = new McpCallBudget();
    const preflight = await this.preflight(question, budget, options);
    if (!preflight) {
      return this.staticResponse(
        "I could not find portfolio evidence for that request. I can answer questions about the site, projects, certificates, snippets, or explicitly linked GitHub context.",
      );
    }

    const githubEnabled = requiresGitHubContext(question);
    const wrapped = wrapMcpTools(preflight.tools, budget);
    const selected = filterToolSet(wrapped, githubEnabled);
    const selectedTools = asToolSet(selected.tools);
    const converted = await convertToModelMessages(this.messages, {
      tools: selectedTools,
      ignoreIncompleteToolCalls: true,
    });
    const compacted = compactModelMessages(converted as ModelMessage[]);
    const workersai = createWorkersAI({ binding: this.environment.AI as never });
    const result = streamText({
      model: workersai(MODEL_ID, { sessionAffinity: this.sessionAffinity }),
      system: buildSystemPrompt(
        summarizeEvidence(preflight.evidence),
        githubEnabled,
        compacted.summary,
      ),
      messages: compacted.messages,
      tools: selectedTools as ToolSet,
      stopWhen: [stepCountIs(MAX_MODEL_PASSES), () => budget.exhausted],
      maxOutputTokens: 700,
      maxRetries: 0,
      abortSignal: options?.abortSignal,
      onEnd: async () => {
        await this.environment.AUTH_DB.prepare(
          "UPDATE threads SET updated_at = ?1 WHERE id = ?2 AND sub = ?3",
        )
          .bind(Date.now(), identity.tid, identity.sub)
          .run();
        console.log("[portfolio-agent] aggregate turn completed");
      },
    });
    if (!compacted.summary) return result.toUIMessageStreamResponse();

    const stream = createUIMessageStream({
      originalMessages,
      execute: ({ writer }) => {
        writer.write({
          type: "data-compaction",
          id: "compaction",
          data: {
            summary: compacted.summary,
            retainedMessages: COMPACTION_RETAINED_MESSAGES,
          },
        } as never);
        writer.merge(result.toUIMessageStream());
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  async exportThread(): Promise<Record<string, unknown>> {
    await this.waitUntilStable({ timeout: 5_000 });
    return {
      threadId: this.identity?.tid ?? null,
      exportedAt: new Date().toISOString(),
      messages: this.messages
        .map(sanitizeExportMessage)
        .filter((message): message is Record<string, unknown> => message !== null),
      note: "Tool inputs and raw MCP payloads are omitted; only text, compacted summaries, citations, and available message timestamps are exported.",
    };
  }

  async deleteThread(): Promise<{ deleted: true }> {
    this.resetTurnState();
    this.messages = [];
    await this.persistMessages([], [], { _deleteStaleRows: true });
    this.sql(["DELETE FROM portfolio_turn_events"] as unknown as TemplateStringsArray);
    return { deleted: true };
  }
}
