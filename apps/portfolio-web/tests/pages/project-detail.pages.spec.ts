import { expect, test } from "playwright/test";
import { projectPageDescription, projectPath, projectSlug } from "../../src/data/projectRoutes";

/**
 * Project detail pages on the Pages runtime.
 *
 * Three things can only be observed here: the head the Function writes, the fragment it injects into
 * `#root`, and the hydrated page the app renders after it discards that fragment. The browser's own
 * archive request is stubbed with CORS headers because this suite's origin is not an allowed API
 * origin, and the API precondition is probed rather than assumed — the middleware serves an
 * unconfirmed project with `noindex` instead of a 404, so a network failure would otherwise look like
 * a passing run.
 */

const API_URL = process.env.VITE_API_URL ?? "https://personal-portfolio.syn-forge.com/api";
const TITLE_SUFFIX = " | Syn-Forge";

type LiveProject = {
  readonly id: number;
  readonly title: string;
  readonly short_description: string;
  readonly long_description: string;
  readonly project_link: string;
  readonly stack: readonly string[];
  readonly highlights: readonly string[];
};

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
  const descriptions = [
    ...html.matchAll(/<meta\b[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/gi),
  ].map((match) => decodeEntities(match[1]));
  const canonical = /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i.exec(html)?.[1] ?? "";
  const graph = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  return { title: decodeEntities(title), descriptions, canonical, graph };
}

/** Read the first live project, so the assertions are about real data rather than a hardcoded id. */
async function readLiveProject(request: import("playwright/test").APIRequestContext) {
  const probe = await request.get(`${API_URL}/v2/projects/archive?limit=12`);
  expect(
    probe.status(),
    `API precondition failed: set VITE_API_URL to a reachable API (tried ${API_URL})`,
  ).toBe(200);

  const payload = (await probe.json()) as { data: LiveProject[] };
  expect(payload.data.length, "the archive must hold at least one project").toBeGreaterThan(0);
  return payload.data[0];
}

/** Serve the browser's archive read with an allowed origin, as the suite's other specs do. */
async function stubBrowserArchive(page: import("playwright/test").Page) {
  const response = await page.request.get(`${API_URL}/v2/projects/archive?limit=12`);
  const body = await response.text();

  await page.route("**/v2/projects/archive**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body,
    }),
  );
}

test("the server head, canonical and graph describe the project", async ({ request }) => {
  const project = await readLiveProject(request);
  const path = projectPath(project.id, project.title);

  const response = await request.get(path);
  expect(response.status()).toBe(200);

  const { title, descriptions, canonical, graph } = readHead(await response.text());
  expect(title).toBe(`${project.title}${TITLE_SUFFIX}`);
  expect(descriptions).toHaveLength(1);
  expect(descriptions[0]).toBe(projectPageDescription(project));
  expect(canonical).toContain(path);

  expect(graph, "the page must carry one JSON-LD block").toBeTruthy();
  const parsed = JSON.parse(graph ?? "{}") as { "@graph"?: Array<Record<string, unknown>> };
  const types = (parsed["@graph"] ?? []).map((node) => node["@type"]);
  expect(types).toEqual(["TechArticle", "BreadcrumbList"]);

  const article = parsed["@graph"]?.[0] ?? {};
  expect(article.headline).toBe(project.title);
  expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("a bare id and a stale slug each redirect once to the canonical URL", async ({ request }) => {
  const project = await readLiveProject(request);
  const path = projectPath(project.id, project.title);

  for (const from of [`/projects/${project.id}`, `/projects/${project.id}/stale-slug`]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(308);
    expect(response.headers().location, from).toContain(path);
  }

  // The destination is a fixed point: one hop, not a chain.
  const settled = await request.get(path, { maxRedirects: 0 });
  expect(settled.status()).toBe(200);
});

test("a project that does not exist is a real 404", async ({ request }) => {
  const response = await request.get("/projects/999999/no-such-project", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
  expect(response.headers()["x-robots-tag"]).toBe("noindex");
});

test("paths that are not detail paths stay 404s", async ({ request }) => {
  for (const path of ["/projects/garbage", "/projects/garbage/x", "/projects/8/x/y"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
});

test("case and trailing slashes normalise to the canonical URL", async ({ request }) => {
  const project = await readLiveProject(request);
  const path = projectPath(project.id, project.title);

  for (const from of [`/PROJECTS/${project.id}/X`, `${path}/`]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(308);
  }

  const settled = await request.get(path, { maxRedirects: 0 });
  expect(settled.status()).toBe(200);
});

test("the raw body carries the heading, summary, facets and text without JavaScript", async ({
  request,
}) => {
  const project = await readLiveProject(request);
  const html = await (await request.get(projectPath(project.id, project.title))).text();

  expect(html).toContain(`<h1>${decodeEntities(project.title)}</h1>`);
  expect(html).toContain('class="prerender-body prerender-project"');
  expect(html).toContain(
    `<p class="prerender-lead">${decodeEntities(project.short_description)}</p>`,
  );
  expect(html).toContain("<h2>Stack</h2>");
  expect(html).toContain("<h2>Highlights</h2>");
  for (const item of [...project.stack, ...project.highlights]) {
    expect(html).toContain(`<li>${decodeEntities(item)}</li>`);
  }

  // One paragraph of the stored prose must survive into the raw body, not only into the bundle.
  const firstParagraph = project.long_description
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .find((block) => block.length > 40 && !block.startsWith("-"));
  expect(firstParagraph, "the first project needs a paragraph to assert").toBeTruthy();
  expect(html).toContain(decodeEntities(firstParagraph ?? "").replace(/\s+/g, " "));
});

test("the sitemap lists every project and no project lastmod", async ({ request }) => {
  const project = await readLiveProject(request);
  const xml = await (await request.get("/sitemap.xml")).text();

  expect(xml).toContain(
    `<loc>https://syn-forge.com${projectPath(project.id, project.title)}</loc>`,
  );
  expect(xml).not.toMatch(/<loc>https:\/\/syn-forge\.com\/projects\/\d+\/[^<]*<\/loc><lastmod>/);
});

test("the archive graph lists every project", async ({ request }) => {
  const html = await (await request.get("/projects")).text();
  const graph = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  const parsed = JSON.parse(graph ?? "{}") as { "@graph"?: Array<Record<string, unknown>> };
  const list = (parsed["@graph"] ?? []).find((node) => node["@type"] === "ItemList");

  expect(list).toBeDefined();
  expect(list?.numberOfItems).toBeGreaterThan(0);
  expect((list?.itemListElement as unknown[]).length).toBe(list?.numberOfItems);
});

test("after hydration the page keeps a project head, one h1, the summary and titled alt text", async ({
  page,
  request,
}) => {
  const project = await readLiveProject(request);
  const path = projectPath(project.id, project.title);
  await stubBrowserArchive(page);

  await page.goto(path);
  await expect(page.locator("#root h1")).toHaveCount(1);
  await expect(page.locator("#root h1")).toHaveText(project.title);
  await expect(page.locator(".project-detail-summary")).toHaveText(project.short_description);

  await expect(page).toHaveTitle(`${project.title}${TITLE_SUFFIX}`);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);

  // The server writes a project-derived social alt; hydration must not replace it with the archive's.
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    `${project.title} — Syn-Forge social preview`,
  );

  const alts = await page
    .locator("img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("alt") ?? ""));
  expect(alts.length).toBeGreaterThan(0);
  for (const alt of alts) {
    expect(alt).not.toBe("");
    expect(alt).toContain(project.title);
  }
});

test("a found bare id replaces itself with the canonical URL", async ({ page, request }) => {
  const project = await readLiveProject(request);
  const path = projectPath(project.id, project.title);
  await stubBrowserArchive(page);

  await page.goto(path);
  await expect(page.locator("#root h1")).toHaveCount(1);

  // Client-side navigation, because a direct request would 308 at the server before the route runs.
  await page.evaluate((id) => {
    history.pushState({}, "", `/projects/${id}`);
    dispatchEvent(new PopStateEvent("popstate"));
  }, project.id);

  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator("#root h1")).toHaveText(project.title);
});

test("a failed project fetch keeps the server head and shows an error, never NotFound", async ({
  page,
  request,
}) => {
  const project = await readLiveProject(request);
  const path = projectPath(project.id, project.title);

  await page.route("**/v2/projects/archive**", (route) => route.abort());
  await page.goto(path);

  await expect(page.locator(".project-detail-state")).toBeVisible();
  await expect(page).toHaveTitle(`${project.title}${TITLE_SUFFIX}`);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);

  // The bare-id route resolves and replaces in place; with the fetch aborted it must show the same
  // error state rather than the NotFound page.
  await page.evaluate((id) => {
    history.pushState({}, "", `/projects/${id}`);
    dispatchEvent(new PopStateEvent("popstate"));
  }, project.id);
  await expect(page.locator(".project-detail-state")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.id}`);

  // And the slug is what the canonical path expects, so the assertion is not vacuous.
  expect(projectSlug(project.title)).toBe(path.split("/").at(-1));
});
