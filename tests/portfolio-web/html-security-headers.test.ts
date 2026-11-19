import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const appRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

async function readMiddleware() {
  return readFile(resolve(appRoot, "functions/_middleware.ts"), "utf8");
}

test("applies the transport header without expanding it to subdomains or preload", async () => {
  const middleware = await readMiddleware();

  assert.match(middleware, /headers\.set\("Strict-Transport-Security", "max-age=31536000"\)/);
  assert.doesNotMatch(middleware, /includeSubDomains/);
  assert.doesNotMatch(middleware, /preload/);
});

test("ships the CSP report-only and names real origins instead of a wildcard default", async () => {
  const middleware = await readMiddleware();

  assert.match(
    middleware,
    /headers\.set\("Content-Security-Policy-Report-Only", HTML_CSP_REPORT_ONLY\)/,
  );
  assert.doesNotMatch(middleware, /headers\.set\("Content-Security-Policy"/);

  const csp = middleware.slice(
    middleware.indexOf("const HTML_CSP_REPORT_ONLY"),
    middleware.indexOf('].join("; ")'),
  );

  assert.doesNotMatch(csp, /default-src \*/);
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://personal-portfolio-bucket.syn-forge.com https://placehold.co https://*.googleusercontent.com",
    "media-src 'self' blob: https://personal-portfolio-bucket.syn-forge.com",
    "frame-src 'self' blob: https://challenges.cloudflare.com",
    "connect-src 'self' https://personal-portfolio.syn-forge.com https://public-auth.syn-forge.com wss://public-auth.syn-forge.com https://challenges.cloudflare.com",
  ]) {
    assert.ok(csp.includes(directive), `missing CSP directive: ${directive}`);
  }
});

test("denies only permissions traced as unused and leaves clipboard-write alone", async () => {
  const middleware = await readMiddleware();

  assert.match(
    middleware,
    /const HTML_PERMISSIONS_POLICY = "camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)"/,
  );
  assert.doesNotMatch(middleware, /clipboard-write=\(\)/);
});

test("drops the obsolete and cross-origin headers from HTML responses", async () => {
  const middleware = await readMiddleware();

  for (const header of [
    "headers.delete(name)",
    '"X-XSS-Protection"',
    '"Expect-CT"',
    '"Access-Control-Allow-Origin"',
  ]) {
    assert.ok(middleware.includes(header), `missing drop for ${header}`);
  }

  // Both HTML paths go through the shared applier, and the served path rebuilds
  // the response rather than mutating the transformer's immutable headers.
  assert.match(middleware, /applyHtmlHeaders\(headers\);\n {2}return new Response/);
  assert.match(middleware, /applyHtmlHeaders\(headers\);[\s\S]*serveNotFound/s);
  assert.match(middleware, /const transformed = rewriter\.transform/);
  assert.match(middleware, /transformed\.headers\.forEach/);
});

test("keeps the sitemap on its early return so XML never gains HTML headers", async () => {
  const middleware = await readMiddleware();

  const sitemapReturn = middleware.indexOf("return (await createSitemapResponse");
  const headerApplication = middleware.indexOf("function applyHtmlHeaders");

  assert.ok(sitemapReturn > 0);
  assert.ok(headerApplication > 0);
  assert.ok(
    middleware.indexOf('if (pathname === "/sitemap.xml")') >
      middleware.indexOf("export const onRequest"),
  );
});
