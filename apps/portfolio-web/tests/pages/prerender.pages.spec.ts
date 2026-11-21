import assert from "node:assert/strict";
import { test } from "playwright/test";
import { PRERENDER_ROUTES } from "../../src/data/prerenderRoutes";

/**
 * Prerendered body content on the Pages runtime.
 *
 * The Functions middleware injects a fragment into `#root` before the response leaves Pages, and React's
 * `createRoot` discards it on the first commit. Everything here is asserted against the raw response first,
 * because that is what a client without JavaScript receives, and then against the hydrated DOM to prove the
 * fragment did not survive as a second copy of the page.
 */

const PRERENDERED = PRERENDER_ROUTES;
const NON_PRERENDERED = ["/netbird"];

test("every public route serves its heading, lead and all seven links in the raw HTML", async ({
  page,
}) => {
  for (const route of PRERENDERED) {
    const response = await page.request.get(route.path);
    assert.equal(response.status(), 200, `${route.path} did not return 200`);
    const html = await response.text();

    assert.ok(html.includes(`<h1>${route.heading}</h1>`), `${route.path} is missing its h1`);
    assert.match(
      html,
      /<p class="prerender-lead">[^<]{40,}<\/p>/,
      `${route.path} is missing its lead`,
    );
    // Containment, not document order: the fragment must be the root's own child, so an append after the
    // closing `</div>` cannot satisfy this.
    assert.match(
      html,
      /<div id="root"[^>]*>\s*<main class="prerender-body"/,
      `${route.path} injected the fragment outside #root`,
    );

    for (const link of PRERENDERED) {
      assert.ok(
        html.includes(`<a href="${link.path}">`),
        `${route.path} does not link to ${link.path}`,
      );
    }
  }
});

test("React replaces the fragment instead of keeping it", async ({ page }) => {
  await page.goto("/privacy-policy", { waitUntil: "networkidle" });

  const headingCount = await page.locator("#root h1").count();
  assert.equal(headingCount, 1);
  assert.equal(await page.locator(".prerender-body").count(), 0);
});

/**
 * Enrichment is optional by design: a build that could not reach the API writes the static fragment without
 * a count line, and the site must still work. So the count is asserted only when the build produced one, and
 * the `+ 1` future-card arithmetic is pinned in `tests/prerender-routes.test.ts`, which needs no network.
 */
test("an enriched build carries the count line, a static build carries none", async ({ page }) => {
  const html = await (await page.request.get("/projects")).text();

  if (!html.includes('class="prerender-count"')) return;
  assert.match(html, /<p class="prerender-count">\[ \d+ projects \]<\/p>/);
});

/**
 * The header count adds the future-project slot exactly once.
 *
 * This is the assertion that catches the double increment: `totalProjectCards` is already
 * `pagination.total + 1`, so passing it to `formatArchiveCount` (which adds the slot itself) produced
 * `[ 9 projects ]` for seven projects. The archive is stubbed here because the Pages origin is not in the
 * API's `ADMIN_WRITE_ORIGINS`, so a live response would be rejected and the header would never leave its
 * loading state.
 */
test("the header count adds the future-project slot exactly once", async ({ page }) => {
  await page.route("**/api/v2/projects/archive**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            id: 1,
            title: "Fixture project",
            type: "image",
            url: "https://personal-portfolio-bucket.syn-forge.com/Projects/fixture.png",
            short_description: "A project used to pin the header count.",
            long_description: "",
            project_link: "",
            display_order: 0,
            created_at: "2026-01-01T00:00:00.000Z",
            gallery: [],
          },
        ],
        pagination: { limit: 12, total: 7, has_more: false, next_cursor: null },
      }),
    }),
  );

  await page.goto("/projects", { waitUntil: "networkidle" });

  // React must already have discarded the injected fragment, otherwise the locator could match the
  // build-time count line instead of the page's header — which would make this test pass for the wrong
  // reason.
  await page.locator(".prerender-body").waitFor({ state: "detached", timeout: 15_000 });

  const countLine = page.getByText(/\[\s*\d+\s+projects\s*\]/);
  await countLine.first().waitFor({ state: "visible", timeout: 15_000 });
  assert.equal((await countLine.first().textContent())?.trim(), "[ 8 projects ]");
});

test("routes outside the prerender set keep an empty shell", async ({ page }) => {
  for (const path of NON_PRERENDERED) {
    const html = await (await page.request.get(path)).text();
    assert.ok(!html.includes('class="prerender-body"'), `${path} received a fragment`);

    const root = html.slice(html.indexOf('id="root"'));
    assert.match(root, /^id="root"[^>]*>\s*<\/div>/, `${path} root is not empty`);
  }
});

test("the fragment files are not publicly reachable", async ({ page }) => {
  const response = await page.request.get("/prerender/projects.html");
  assert.equal(response.status(), 404);
});

test("security headers still apply after injection", async ({ page }) => {
  const publicRoute = await page.request.get("/projects");
  assert.equal(publicRoute.headers()["strict-transport-security"], "max-age=31536000");

  const nonIndexable = await page.request.get("/netbird");
  assert.equal(nonIndexable.headers()["x-robots-tag"], "noindex, follow");
});
