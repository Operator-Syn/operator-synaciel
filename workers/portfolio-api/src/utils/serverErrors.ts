import type { Context } from "hono";

type JsonCapableContext = Pick<Context, "json">;

export function redactSensitiveLogText(value: string): string {
  return value
    .replace(
      /([?&](?:X-Amz-[^=&\s]+|code|state|access_token|refresh_token|id_token|token|signature)=)[^&\s]*/gi,
      "$1<REDACTED>",
    )
    .replace(/(Authorization\s*[:=]\s*Bearer\s+)[^\s,;]+/gi, "$1<REDACTED>")
    .replace(/((?:Cookie|Set-Cookie)\s*[:=]\s*)[^\s,;]+/gi, "$1<REDACTED>")
    .replace(/(Authorization\s*[:=]\s*)(?!Bearer\s+)[^\s,;]+/gi, "$1<REDACTED>");
}

function safeErrorDescription(err: unknown): string {
  if (err instanceof Error) {
    return redactSensitiveLogText(`${err.name}: ${err.message || "Unknown error"}`);
  }

  if (typeof err === "string") return redactSensitiveLogText(err);

  return "Non-Error exception";
}

export function logInternalError(scope: string, err: unknown): void {
  console.error(`[${scope}] ${safeErrorDescription(err)}`);
}

export function respondWithInternalError(
  c: JsonCapableContext,
  scope: string,
  err: unknown,
  status: 500 = 500,
) {
  logInternalError(scope, err);
  return c.json({ error: "Internal Server Error" }, status);
}
