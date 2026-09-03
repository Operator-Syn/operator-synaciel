import type { AgentProps } from "./config.ts";

export const AGENT_IDENTITY_HEADER = "x-portfolio-agent-identity";

export function encodeAgentIdentity(identity: AgentProps): string {
  return JSON.stringify({
    sub: identity.sub,
    sid: identity.sid,
    tid: identity.tid,
    q: identity.q,
  });
}

export function parseAgentIdentity(
  value: string | null,
  expectedThreadId?: string,
): AgentProps | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      !parsed ||
      Array.isArray(parsed) ||
      typeof parsed.sub !== "string" ||
      parsed.sub.length === 0 ||
      typeof parsed.sid !== "string" ||
      parsed.sid.length === 0 ||
      typeof parsed.tid !== "string" ||
      parsed.tid.length === 0 ||
      typeof parsed.q !== "number" ||
      !Number.isSafeInteger(parsed.q) ||
      (expectedThreadId !== undefined && parsed.tid !== expectedThreadId)
    ) {
      return null;
    }
    return { sub: parsed.sub, sid: parsed.sid, tid: parsed.tid, q: parsed.q };
  } catch {
    return null;
  }
}
