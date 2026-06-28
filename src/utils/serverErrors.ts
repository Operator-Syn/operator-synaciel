import type { Context } from "hono";

type JsonCapableContext = Pick<Context, "json">;

export function respondWithInternalError(
  c: JsonCapableContext,
  scope: string,
  err: unknown,
  status: 500 = 500,
) {
  console.error(`[${scope}]`, err);
  return c.json({ error: "Internal Server Error" }, status);
}
