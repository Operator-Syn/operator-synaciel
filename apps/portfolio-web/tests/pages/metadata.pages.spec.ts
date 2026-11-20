import { expect, test } from "playwright/test";
import { PORTFOLIO_MCP_DESCRIPTION } from "../../src/data/portfolioMcp";
import { getSocialPreviewMetadata } from "../../src/data/socialPreview";

/**
 * Metadata behaviour that only exists on the Pages runtime.
 *
 * Two failure modes are covered and must stay separate:
 *   1. the Pages Function's server-rendered head — what a crawler receives;
 *   2. the client's post-hydration head — what a JS browser ends up with.
 * A client-side default can mask a broken server rewrite, so the server head is
 * read from the raw response rather than from the rendered DOM.
 */

const INDEXABLE_PATHS = [
  "/",
  "/projects",
  "/certificates",
  "/snippets",
  "/ai",
  "/privacy-policy",
  "/terms-and-conditions",
] as const;

const TITLE_SUFFIX = " | Syn-Forge";

/** The middleware HTML-escapes attribute text, so decode before comparing. */
function decodeEntities(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readHead(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  // Any meta tag carrying `name="description"`, wherever the attribute order
  // puts it: the static shell's tag starts with `id="meta-description"`, so a
  // matcher anchored on `<meta name=` would not see it and a server-side
  // duplicate would pass.
  const descriptions = [
    ...html.matchAll(/<meta\b[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/gi),
  ].map((match) => decodeEntities(match[1]));
  const staticIds = html.match(/id="meta-description"/g)?.length ?? 0;
  return { title: decodeEntities(title), descriptions, staticIds };
}

test("the Pages Function emits the budgeted head for every indexable route", async ({
  request,
}) => {
  for (const pathname of INDEXABLE_PATHS) {
    const response = await request.get(pathname);
    expect(response.status(), pathname).toBe(200);

    const { title, descriptions, staticIds } = readHead(await response.text());
    const expected = getSocialPreviewMetadata(pathname);

    expect(title, `${pathname} server title`).toBe(`${expected.title}${TITLE_SUFFIX}`);
    expect(title.length, `${pathname} server title length`).toBeGreaterThanOrEqual(50);
    expect(title.length, `${pathname} server title length`).toBeLessThanOrEqual(60);
    expect(descriptions, `${pathname} server description count`).toHaveLength(1);
    expect(staticIds, `${pathname} static description id`).toBe(0);
    expect(descriptions[0], pathname).toBe(expected.description);
    expect(descriptions[0].length, `${pathname} description length`).toBeGreaterThanOrEqual(120);
    expect(descriptions[0].length, `${pathname} description length`).toBeLessThanOrEqual(155);
  }
});

test("hydration leaves exactly one description tag", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    getSocialPreviewMetadata("/projects").description,
  );
  await expect(page.locator("#meta-description")).toHaveCount(0);
  await expect(page).toHaveTitle(`${getSocialPreviewMetadata("/projects").title}${TITLE_SUFFIX}`);
});

test("an in-app navigation re-derives the head from the map", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // The served document was rendered for `/`, so the `/projects` values can only
  // come from the client. It exercises the title/description defaults, not the
  // pathname fallback (Projects passes `url`; the 404 test below covers that).
  // The `/ai` case is the discriminating one: its old literal props differed
  // from the map, so it fails pre-change for the defaulting itself.
  await page.evaluate(() => {
    history.pushState({}, "", "/projects");
    dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page).toHaveTitle(`${getSocialPreviewMetadata("/projects").title}${TITLE_SUFFIX}`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    getSocialPreviewMetadata("/projects").description,
  );
});

test("the /ai meta uses the map copy while the lede and graph keep the MCP copy", async ({
  page,
}) => {
  await page.goto("/ai");
  await page.waitForLoadState("networkidle");

  // The meta description is SERP copy; the lede is body copy. They are allowed
  // to differ, and this pins which one owns which.
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    getSocialPreviewMetadata("/ai").description,
  );
  await expect(page.locator(".ai-page-lede")).toContainText(PORTFOLIO_MCP_DESCRIPTION);

  const graph = await page.locator('script[type="application/ld+json"]').first().textContent();
  const parsed = JSON.parse(graph ?? "{}") as {
    "@graph"?: Array<{ "@type"?: string; description?: string }>;
  };
  const application = parsed["@graph"]?.find((node) => node["@type"] === "SoftwareApplication");
  expect(application, "SoftwareApplication node").toBeDefined();
  expect(application?.description).toBe(PORTFOLIO_MCP_DESCRIPTION);
});

test("a snippet document derives its head from the path, not the API filename", async ({
  page,
  request,
}) => {
  const pathname = "/snippets/document/22/database-migrations.md";
  const expected = getSocialPreviewMetadata(pathname);

  // Precondition, stated rather than assumed: VITE_API_URL must point at a
  // reachable API for the middleware's document lookup to be meaningful. The
  // middleware degrades a failed lookup to "unknown" and still serves 200, so
  // without this probe a network failure would look like a passing run.
  const apiUrl = process.env.VITE_API_URL ?? "https://personal-portfolio.syn-forge.com/api";
  const apiProbe = await request.get(`${apiUrl}/v2/snippets/22`);
  expect(
    apiProbe.status(),
    `API precondition failed: set VITE_API_URL to a reachable API (tried ${apiUrl})`,
  ).toBe(200);

  // The crawler-facing head is the deliverable, so it is read from the raw
  // response. The API name for this document is "Database Migrations.md"; the
  // slug-derived title must not be that filename.
  const response = await request.get(pathname);
  expect(response.status()).toBe(200);
  const { title, descriptions } = readHead(await response.text());
  expect(title).toBe(`${expected.title}${TITLE_SUFFIX}`);
  expect(descriptions).toHaveLength(1);
  expect(descriptions[0]).toBe(expected.description);
  expect(title).not.toContain(".md");

  // And the client must keep the same head rather than overwriting it with the
  // API filename. The document body itself needs the API (blocked by CORS from
  // a local origin), so this asserts the head, not the rendered body.
  await page.goto(pathname);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(`${expected.title}${TITLE_SUFFIX}`);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
});

test("the 404 route keeps its own head instead of inheriting the home copy", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // The app-root head manager resolves the map for the current path, and the
  // map falls back to the home entry for unknown paths. NotFound's explicit
  // copy must win, which is only true while the page-level manager runs last.
  await page.evaluate(() => {
    history.pushState({}, "", "/this-path-does-not-exist");
    dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page).toHaveTitle("Page not found | Syn-Forge");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "The requested Syn-Forge page could not be found. Return to the portfolio home or open the public AI guide.",
  );
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});
