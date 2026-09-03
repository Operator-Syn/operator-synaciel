import { randomUUID } from "node:crypto";

/** Identifies one in-memory MCP process for safe plan recovery diagnostics. */
export const REPOSITORY_MCP_INSTANCE_ID = randomUUID();
