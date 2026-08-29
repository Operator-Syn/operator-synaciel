import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedBrowserOrigin,
  parseBrowserOrigins,
} from "../../workers/portfolio-agent/src/validation.ts";

test("agent origin checks use configured browser origins", () => {
  const allowedOrigins = parseBrowserOrigins("http://localhost:5173,https://syn-forge.com");

  assert.equal(isAllowedBrowserOrigin(null, allowedOrigins), true);
  assert.equal(isAllowedBrowserOrigin("http://localhost:5173", allowedOrigins), true);
  assert.equal(isAllowedBrowserOrigin("https://syn-forge.com", allowedOrigins), true);
  assert.equal(isAllowedBrowserOrigin("https://evil.example", allowedOrigins), false);
});

test("agent origin configuration rejects malformed entries", () => {
  const allowedOrigins = parseBrowserOrigins("https://syn-forge.com/path, javascript:alert(1)");

  assert.equal(allowedOrigins.size, 0);
  assert.equal(isAllowedBrowserOrigin("https://syn-forge.com", allowedOrigins), false);
});
