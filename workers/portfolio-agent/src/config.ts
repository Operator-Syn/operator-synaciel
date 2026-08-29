import type { Ai, D1Database, DurableObjectNamespace } from "@cloudflare/workers-types";

export const AGENT_CLASS_NAME = "PortfolioAgent";
export const MODEL_ID = "@cf/zai-org/glm-4.7-flash" as const;
export const MCP_SERVER_NAME = "portfolio";
export const MAX_MODEL_PASSES = 10;
export const MAX_MCP_CALLS = 20;
export const MAX_QUESTION_CHARS = 2_000;
export const MAX_PERSISTED_MESSAGES = 200;
export const COMPACTION_TURN_THRESHOLD = 20;
export const COMPACTION_INPUT_TOKEN_THRESHOLD = 8_000;
export const COMPACTION_RETAINED_MESSAGES = 6;
export const THREAD_BURST_LIMIT = 5;
export const THREAD_BURST_WINDOW_MS = 10 * 60 * 1_000;
export const DAILY_TURN_LIMIT = 20;
export const NEURON_ESTIMATE_PER_TURN = 350;
export const AUTO_PAUSE_LIMIT = 8_000;

export type AgentProps = {
  sub: string;
  sid: string;
  tid: string;
  q: number;
};

export type PortfolioAgentEnvironment = {
  AI: Ai;
  AUTH_DB: D1Database;
  PortfolioAgent: DurableObjectNamespace;
  PORTFOLIO_MCP_URL: string;
  PUBLIC_AUTH_ORIGIN: string;
  AGENT_AUDIENCE: string;
  BROWSER_ORIGINS: string;
  [name: string]: unknown;
};

export type AgentIdentityRow = {
  sub: string;
  sid: string;
  tid: string;
  q: number;
};

export function getConfigString(
  environment: PortfolioAgentEnvironment,
  ...segments: string[]
): string {
  const value = environment[segments.join("_")];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Required runtime configuration is missing.");
  }
  return value;
}
