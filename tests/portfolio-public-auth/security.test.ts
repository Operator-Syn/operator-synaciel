import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AGENT_ACCESS_TTL_SECONDS,
  DAILY_TURN_LIMIT,
  getSessionCookieSameSite,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  THREAD_BURST_LIMIT,
  WORKERS_AI_AUTO_PAUSE_LIMIT,
  WORKERS_AI_DAILY_NEURON_BUDGET,
} from "../../workers/portfolio-public-auth/src/config.ts";
import {
  isAllowedBrowserOrigin,
  isValidThreadId,
  parseBrowserOrigins,
  safeDisplayName,
  sanitizeReturnTo,
} from "../../workers/portfolio-public-auth/src/validation.ts";

test("uses bounded public-auth session and quota constants", () => {
  assert.equal(SESSION_COOKIE, "__Host-portfolio_session");
  assert.equal(SESSION_MAX_AGE_SECONDS, 30 * 24 * 60 * 60);
  assert.equal(AGENT_ACCESS_TTL_SECONDS, 5 * 60);
  assert.equal(DAILY_TURN_LIMIT, 20);
  assert.equal(THREAD_BURST_LIMIT, 5);
  assert.equal(WORKERS_AI_DAILY_NEURON_BUDGET, 10_000);
  assert.equal(WORKERS_AI_AUTO_PAUSE_LIMIT, 8_000);
});

test("validates opaque thread IDs and browser origins", () => {
  assert.equal(isValidThreadId("a".repeat(18)), true);
  assert.equal(isValidThreadId("short"), false);
  assert.equal(isValidThreadId("../escape"), false);
  const allowedOrigins = parseBrowserOrigins(
    "https://syn-forge.com, https://www.syn-forge.com, http://localhost:5173",
  );
  assert.equal(isAllowedBrowserOrigin("https://syn-forge.com", allowedOrigins), true);
  assert.equal(isAllowedBrowserOrigin("http://localhost:5173", allowedOrigins), true);
  assert.equal(isAllowedBrowserOrigin("https://evil.example", allowedOrigins), false);
  assert.equal(isAllowedBrowserOrigin("https://syn-forge.com/path", allowedOrigins), false);
  assert.equal(parseBrowserOrigins("https://syn-forge.com/path,not-a-url").size, 0);
});

test("keeps OAuth return targets on the configured portfolio origin", () => {
  assert.equal(
    sanitizeReturnTo("https://evil.example/callback", "https://syn-forge.com"),
    "https://syn-forge.com",
  );
  assert.equal(
    sanitizeReturnTo("https://syn-forge.com/assistant?state=ok", "https://syn-forge.com"),
    "https://syn-forge.com/assistant?state=ok",
  );
  assert.equal(
    sanitizeReturnTo("http://localhost:5173/assistant", "http://localhost:5173"),
    "http://localhost:5173/assistant",
  );
  const productionAllowedOrigins = parseBrowserOrigins(
    "https://syn-forge.com,https://www.syn-forge.com,http://localhost:5173",
  );
  assert.equal(
    sanitizeReturnTo(
      "http://localhost:5173/assistant",
      "https://syn-forge.com",
      productionAllowedOrigins,
    ),
    "http://localhost:5173/assistant",
  );
  assert.equal(
    sanitizeReturnTo(
      "https://evil.example/callback",
      "https://syn-forge.com",
      productionAllowedOrigins,
    ),
    "https://syn-forge.com",
  );
  assert.equal(safeDisplayName("Ada <script>"), "Ada <script>");
});

test("uses cross-site session cookies only when explicitly configured", () => {
  assert.equal(getSessionCookieSameSite({ SESSION_COOKIE_SAME_SITE: "None" } as never), "None");
  assert.equal(getSessionCookieSameSite({ SESSION_COOKIE_SAME_SITE: "Lax" } as never), "Lax");
  assert.equal(getSessionCookieSameSite({ SESSION_COOKIE_SAME_SITE: "invalid" } as never), "Lax");
});
