import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  AGENT_ACCESS_TTL_SECONDS,
  getSessionCookieSameSite,
  ROLLING_TOKEN_BUDGET,
  ROLLING_TOKEN_WINDOW_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../../workers/portfolio-public-auth/src/config.ts";
import {
  isAllowedBrowserOrigin,
  isValidThreadId,
  parseBrowserOrigins,
  safeDisplayName,
  safeGoogleProfilePictureUrl,
  sanitizeReturnTo,
} from "../../workers/portfolio-public-auth/src/validation.ts";

const rollingUsageMigration = resolve(
  import.meta.dirname,
  "../../workers/portfolio-public-auth/migrations/0001_add_rolling_token_usage.sql",
);
const actualUsageMigration = resolve(
  import.meta.dirname,
  "../../workers/portfolio-public-auth/migrations/0002_add_actual_token_usage.sql",
);
const profilePictureMigration = resolve(
  import.meta.dirname,
  "../../workers/portfolio-public-auth/migrations/0003_add_google_profile_picture.sql",
);
const authIndex = resolve(import.meta.dirname, "../../workers/portfolio-public-auth/src/index.ts");

test("uses bounded public-auth session and quota constants", () => {
  assert.equal(SESSION_COOKIE, "__Host-portfolio_session");
  assert.equal(SESSION_MAX_AGE_SECONDS, 30 * 24 * 60 * 60);
  assert.equal(AGENT_ACCESS_TTL_SECONDS, 5 * 60);
  assert.equal(ROLLING_TOKEN_BUDGET, 1_000_000);
  assert.equal(ROLLING_TOKEN_WINDOW_SECONDS, 60 * 60);
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
  assert.equal(
    safeGoogleProfilePictureUrl("https://lh3.googleusercontent.com/a/profile=s96-c"),
    "https://lh3.googleusercontent.com/a/profile=s96-c",
  );
  assert.equal(safeGoogleProfilePictureUrl("http://lh3.googleusercontent.com/a/profile"), null);
  assert.equal(safeGoogleProfilePictureUrl("https://avatars.example/avatar.png"), null);
  assert.equal(
    safeGoogleProfilePictureUrl("https://lh3.googleusercontent.com.evil.example/avatar"),
    null,
  );
});

test("uses cross-site session cookies only when explicitly configured", () => {
  assert.equal(getSessionCookieSameSite({ SESSION_COOKIE_SAME_SITE: "None" } as never), "None");
  assert.equal(getSessionCookieSameSite({ SESSION_COOKIE_SAME_SITE: "Lax" } as never), "Lax");
  assert.equal(getSessionCookieSameSite({ SESSION_COOKIE_SAME_SITE: "invalid" } as never), "Lax");
});

test("stores rolling reservations by subject and creation time", async () => {
  const migration = await readFile(rollingUsageMigration, "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS rolling_token_usage/);
  assert.match(migration, /sub TEXT NOT NULL REFERENCES users\(sub\)/);
  assert.match(migration, /created_at INTEGER NOT NULL/);
  assert.match(migration, /estimated_tokens INTEGER NOT NULL/);
  assert.match(migration, /rolling_token_usage_sub_created_idx/);
  const actualMigration = await readFile(actualUsageMigration, "utf8");
  assert.match(
    actualMigration,
    /ALTER TABLE rolling_token_usage\s+ADD COLUMN actual_input_tokens INTEGER/,
  );
  assert.match(
    actualMigration,
    /ALTER TABLE rolling_token_usage\s+ADD COLUMN actual_output_tokens INTEGER/,
  );
  assert.match(actualMigration, /actual_input_tokens IS NULL OR actual_input_tokens >= 0/);
  assert.match(actualMigration, /actual_output_tokens IS NULL OR actual_output_tokens >= 0/);
  const profileMigration = await readFile(profilePictureMigration, "utf8");
  assert.match(profileMigration, /ALTER TABLE users/);
  assert.match(profileMigration, /ADD COLUMN picture_url TEXT/);
  assert.match(profileMigration, /length\(picture_url\) <= 2048/);
});

test("does not let token issuance hide history behind a legacy daily counter", async () => {
  const source = await readFile(authIndex, "utf8");
  const tokenRoute = source.slice(
    source.indexOf('app.post("/agent/token"'),
    source.indexOf('app.get("/threads/:id/export")'),
  );
  assert.doesNotMatch(tokenRoute, /usage_windows|DAILY_TURN_LIMIT|DAILY_LIMIT/);
  assert.match(tokenRoute, /AGENT_PAUSED/);
  assert.match(tokenRoute, /clearLegacyAutomaticPause/);
  assert.doesNotMatch(tokenRoute, /estimated_neurons\s*(?:>=|>)/);
  assert.match(tokenRoute, /paused by an administrator/);
});
