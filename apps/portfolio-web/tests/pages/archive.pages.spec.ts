import assert from "node:assert/strict";
import { expect, type Page, type Route, test } from "playwright/test";

/**
 * Archive, heading, and footer behaviour on the Pages runtime.
 *
 * Every request this suite depends on is fulfilled here. The Pages suite serves
 * from `127.0.0.1:4319`, which is not in the API's `ADMIN_WRITE_ORIGINS`, so the
 * browser receives no `access-control-allow-origin` from the real API and rejects
 * the response. Playwright's fulfilment does not bypass that check either, which
 * is why every stub sets the header itself.
 *
 * The certificate grid is sized by a container query on `.certificate-archive-shell`
 * (`max-width: 1239px`), not by the viewport, so this suite runs at the
 * repository's reference desktop size and asserts the shell width before it
 * inspects any grid behaviour.
 */

test.use({ viewport: { width: 1586, height: 992 } });

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

const WIDE_LAYOUT_MIN_WIDTH = 1239;

/** Media host the API returns; transforms are served from under it. */
const MEDIA_ORIGIN = "https://personal-portfolio-bucket.syn-forge.com";
const MEDIA_IMAGE = `${MEDIA_ORIGIN}/Projects/fixture.png`;

/** A 1x1 PNG, so every image response in this suite is served by the suite. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type ProjectEntry = {
  id: number;
  title: string;
  type: "image" | "video";
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  display_order: number;
  created_at: string;
  gallery: Array<{
    id: number;
    project_id: number;
    type: "image" | "video";
    url: string;
    display_order: number;
  }>;
};

type CertificateEntry = {
  id: number;
  title: string;
  type: "image" | "video";
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string | null;
  display_order: number;
  created_at: string;
  items: Array<{
    id: number;
    certificate_id: number;
    type: "image" | "video";
    url: string;
    display_order: number;
  }>;
};

const SNIPPET_TREE = {
  data: [
    {
      id: 11,
      name: "agent-notes.md",
      type: "file",
      modified: "2026-05-02",
      size: 1800,
      format: "md",
    },
    {
      id: 12,
      name: "database",
      type: "dir",
      modified: "2026-06-11",
      children: [
        {
          id: 22,
          name: "Database Migrations.md",
          type: "file",
          modified: "2026-06-11",
          size: 4096,
          format: "md",
        },
        {
          id: 23,
          name: "schema-cheatsheet.pdf",
          type: "file",
          modified: "2026-06-10",
          size: 90000,
          format: "pdf",
        },
      ],
    },
  ],
};

const HOME_PAYLOAD = {
  site: {
    headerPhrase: "Operator Synaciel",
    mobileHeaderPhrase: "Operator Synaciel",
    profileImage: `${MEDIA_ORIGIN}/ProfilePicture/nice.webp`,
    status: "Available",
  },
  profile: [
    { label: "Name", value: "Ada Lovelace" },
    { label: "Role", value: "Engineer" },
  ],
  sections: [],
  projects: [],
};

function buildProjects(count: number): ProjectEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 100 + index,
    title: `Project ${String(index + 1).padStart(2, "0")}`,
    type: "image" as const,
    url: MEDIA_IMAGE,
    short_description: `Short description ${index + 1}`,
    long_description: "",
    project_link: "",
    display_order: index,
    created_at: "2026-01-01T00:00:00.000Z",
    gallery: [],
  }));
}

function buildCertificates(count: number): CertificateEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 200 + index,
    title: `Certification ${String(index + 1).padStart(2, "0")}`,
    type: "image" as const,
    url: `${MEDIA_ORIGIN}/Certificates/fixture.png`,
    short_description: `Short certification ${index + 1}`,
    long_description: "",
    certificate_link: null,
    display_order: index,
    created_at: "2026-01-01T00:00:00.000Z",
    items: [],
  }));
}

function archiveBody<T>(data: T[]) {
  return JSON.stringify({
    data,
    pagination: { limit: 12, total: data.length, has_more: false, next_cursor: null },
  });
}

async function fulfillJson(route: Route, body: string) {
  await route.fulfill({ status: 200, headers: CORS_HEADERS, body });
}

/**
 * Install every API stub this suite needs. Tests override only the archive they
 * care about; `/home` and `/snippets` are always stubbed because visiting `/` or
 * `/snippets` fetches them and an unstubbed request fails on CORS.
 *
 * `holdCertificates` leaves the certificate request unanswered instead of
 * fulfilling it, which is the only way to observe the loading skeleton here.
 */
async function stubApi(
  page: Page,
  options: {
    projects?: ProjectEntry[];
    certificates?: CertificateEntry[];
    holdCertificates?: boolean;
  } = {},
) {
  // Every media request is answered here: the suite's contract is that it fulfils what
  // it depends on, and an assertion about `src` must not hinge on a live third party.
  await page.route("**/cdn-cgi/image/**", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "image/png" }, body: TINY_PNG }),
  );
  await page.route(`${MEDIA_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "image/png" }, body: TINY_PNG }),
  );
  await page.route("**/api/home**", (route) => fulfillJson(route, JSON.stringify(HOME_PAYLOAD)));
  await page.route("**/api/snippets**", (route) =>
    fulfillJson(route, JSON.stringify(SNIPPET_TREE)),
  );
  await page.route("**/api/v2/projects/archive**", (route) =>
    fulfillJson(route, archiveBody(options.projects ?? buildProjects(7))),
  );
  await page.route("**/api/v2/certificates/archive**", (route) => {
    // Never fulfilling leaves the request open, so the page stays in its loading
    // state for as long as the test needs.
    if (options.holdCertificates) return;
    return fulfillJson(route, archiveBody(options.certificates ?? buildCertificates(8)));
  });
}

/**
 * Read the layout facts of the certificate grid: whether each card takes the full
 * width, and the trailing border bound to it.
 */
async function readGrid(page: Page) {
  const shell = page.locator(".certificate-archive-shell");
  const shellWidth = await shell.evaluate((element) => element.clientWidth);
  const cards = page.locator(".certificate-archive-card");
  const cells = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const style = window.getComputedStyle(element);
      return {
        span: style.gridColumnStart === "1" && style.gridColumnEnd === "-1",
        border: style.borderRightWidth,
      };
    }),
  );

  return { shellWidth, cells };
}

/** Left-column cards carry the interior rule; right-column and full-width cards do not. */
function expectedBorders(count: number, trailingSpans: boolean) {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    if (position === count && trailingSpans) return "0px";
    return position % 2 === 1 ? "1px" : "0px";
  });
}

test("renders every record the archive returns, without cursor controls on a single page", async ({
  page,
}) => {
  const projects = buildProjects(7);
  await stubApi(page, { projects });

  await page.goto("/projects");

  const rows = page.locator(".project-archive-row");
  // One card per record plus the "still cooking" card, which appears only when
  // the archive reports no further page.
  await expect(rows).toHaveCount(projects.length + 1);

  for (const project of projects) {
    await expect(page.getByRole("heading", { name: project.title, exact: true })).toBeVisible();
  }

  await expect(page.locator(".project-archive-pagination")).toHaveCount(0);
});

test("links every archive row to its detail page but leaves the future card as text", async ({
  page,
}) => {
  const projects = buildProjects(3);
  await stubApi(page, { projects });

  await page.goto("/projects");

  for (const project of projects) {
    const heading = page.getByRole("heading", { name: project.title, exact: true });
    await expect(heading.locator("a")).toHaveCount(1);
    await expect(heading.locator("a")).toHaveAttribute("href", /^\/projects\/\d+\//);
  }

  // The "still cooking" placeholder is not a project, so it must not publish a detail URL.
  const future = page.getByRole("heading", { name: "Still cooking", exact: true });
  await expect(future.locator("a")).toHaveCount(0);
  await expect(page.locator('a[href^="/projects/999999/"]')).toHaveCount(0);
});

test("links every snippet document in the tree, folders included", async ({ page }) => {
  await stubApi(page);

  await page.goto("/snippets");

  const links = page.locator('a[href^="/snippets/document/"]');
  await expect(links).toHaveCount(3);

  // The route is /snippets/document/<id>/<slug>: the id is the second segment and
  // the slug is last, so the assertion is a prefix rather than a suffix.
  await expect(page.locator('a[href^="/snippets/document/11/"]')).toHaveCount(1);
  await expect(page.locator('a[href^="/snippets/document/22/"]')).toHaveCount(1);
  await expect(page.locator('a[href^="/snippets/document/23/"]')).toHaveCount(1);
});

test("gives every page a site footer except the home page", async ({ page }) => {
  await stubApi(page);

  await page.goto("/projects");
  const footer = page.locator("footer.site-footer");
  await expect(footer).toHaveCount(1);
  await expect(footer.getByRole("navigation", { name: "Site" })).toBeVisible();
  // Every public route, including the two legal pages: the footer is the site's own
  // index of itself, not just a copy of the header navigation.
  await expect(footer.locator("a")).toHaveCount(7);
  // The copyright line is what marks the end of the document. Without it the footer is
  // only a row of links and reads as a second navigation bar.
  await expect(footer.locator(".site-footer-meta")).toContainText("Operator-Syn");

  await page.goto("/");
  await expect(page.locator("footer.site-footer")).toHaveCount(0);
});

test("renders one visible h1 and a headed document list on the snippets index", async ({
  page,
}) => {
  await stubApi(page);

  await page.goto("/snippets");

  const headings = page.locator("h1");
  await expect(headings).toHaveCount(1);

  const h1 = headings.first();
  await expect(h1).toBeVisible();
  await expect(h1).toHaveText(/code snippets/i);

  await expect(page.getByRole("heading", { name: "All documents", level: 2 })).toBeVisible();
});

test("describes the profile portrait with the name the API reports", async ({ page }) => {
  await stubApi(page);

  await page.goto("/");

  const portrait = page.locator(".homepage-profile-image img");
  await expect(portrait).toHaveCount(1);
  await expect(portrait).toHaveAttribute("alt", /Ada Lovelace/);
});

test("lays out six cards from five records without a trailing span", async ({ page }) => {
  await stubApi(page, { certificates: buildCertificates(5) });

  await page.goto("/certificates");
  await expect(page.locator(".certificate-archive-card")).toHaveCount(6);

  const grid = await readGrid(page);
  // The container query, not the viewport, decides the layout. If this fails, the
  // rest of the assertions would be measuring the single-column state.
  expect(grid.shellWidth).toBeGreaterThan(WIDE_LAYOUT_MIN_WIDTH);
  expect(grid.cells.map((cell) => cell.border)).toEqual(expectedBorders(6, false));
  expect(grid.cells.some((cell) => cell.span)).toBe(false);
});

test("lays out eight cards from seven records without a trailing span", async ({ page }) => {
  await stubApi(page, { certificates: buildCertificates(7) });

  await page.goto("/certificates");
  await expect(page.locator(".certificate-archive-card")).toHaveCount(8);

  const grid = await readGrid(page);
  expect(grid.shellWidth).toBeGreaterThan(WIDE_LAYOUT_MIN_WIDTH);
  expect(grid.cells.map((cell) => cell.border)).toEqual(expectedBorders(8, false));
  expect(grid.cells.some((cell) => cell.span)).toBe(false);
});

test("gives an odd trailing certificate the full width and no interior rule", async ({ page }) => {
  await stubApi(page, { certificates: buildCertificates(8) });

  await page.goto("/certificates");
  await expect(page.locator(".certificate-archive-card")).toHaveCount(9);

  const grid = await readGrid(page);
  expect(grid.shellWidth).toBeGreaterThan(WIDE_LAYOUT_MIN_WIDTH);
  expect(grid.cells.map((cell) => cell.border)).toEqual(expectedBorders(9, true));

  // Only the ninth card spans; the eight above it stay in their two columns.
  expect(grid.cells[8]).toEqual({ span: true, border: "0px" });
  expect(grid.cells.slice(0, 8).some((cell) => cell.span)).toBe(false);
});

test("keeps the loading skeleton on one card per column with no span", async ({ page }) => {
  await stubApi(page, { holdCertificates: true });

  await page.goto("/certificates");
  await expect(page.locator(".certificate-archive-card-loading")).toHaveCount(6);

  const grid = await readGrid(page);
  expect(grid.shellWidth).toBeGreaterThan(WIDE_LAYOUT_MIN_WIDTH);
  expect(grid.cells.map((cell) => cell.border)).toEqual(expectedBorders(6, false));
  expect(grid.cells.some((cell) => cell.span)).toBe(false);
});

test("serves the self-hosted fonts and never reaches Google", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
      foreign.push(url);
    }
  });

  // The font requests are made by CSS, so they are recorded rather than awaited:
  // a missing file would still be a request, and the response check below is what
  // proves the file is served.
  const fontResponses: Array<{ url: string; status: number; type: string }> = [];
  page.on("response", (response) => {
    if (response.url().includes("/fonts/")) {
      fontResponses.push({
        url: response.url(),
        status: response.status(),
        type: response.headers()["content-type"] ?? "",
      });
    }
  });

  await stubApi(page);
  await page.goto("/");
  await page.waitForLoadState("load");
  // Force the body and display faces to be used and therefore fetched.
  await expect(page.locator("h1")).toBeVisible();

  expect(foreign).toEqual([]);

  const sans = fontResponses.find((entry) => entry.url.endsWith("/fonts/ibm-plex-sans-var.woff2"));
  expect(sans, "the preloaded body face is fetched").toBeDefined();
  expect(sans?.status).toBe(200);
  expect(sans?.type).toContain("font/woff2");
});

test("keeps the settings panel copy out of the document until it is opened", async ({ page }) => {
  await stubApi(page);
  await page.goto("/projects");

  // The drawer's theme labels are ~160 words a crawler would otherwise read as
  // page content on every route.
  await expect(page.getByText("The Ancient Blue Ledger")).toHaveCount(0);

  await page.getByRole("button", { name: /appearance settings/i }).click();
  await expect(page.getByText("The Ancient Blue Ledger")).toBeVisible();

  // The body mounts in the same commit that opens the panel, so the focus effect
  // finds its first control rather than racing an empty element.
  await expect(page.getByRole("button", { name: /close settings/i })).toBeFocused();

  await page.getByRole("button", { name: /close settings/i }).click();

  // Closing must not unmount the body in the same commit, or the exit transition
  // animates an empty shell.
  await expect(page.locator("#home-settings-title")).toBeAttached();
});

test("opens the settings panel from the compact dock menu", async ({ page }) => {
  await stubApi(page);
  // The compact dock is gated by a container query on the coordinate rail, not by a
  // plain media query: at 600 px the rail is wide enough that the in-panel trigger
  // stays visible and the dock menu stays hidden. 360 px is inside the compact range.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/projects");

  // On compact layouts the in-panel trigger is hidden, so the dock's menu is the
  // only open path — the one that does not go through the trigger handler.
  await expect(page.getByRole("button", { name: /appearance settings/i })).toBeHidden();

  await page.getByRole("button", { name: /open floating controls/i }).click();
  await page.getByRole("button", { name: /^settings$/i }).click();

  await expect(page.getByText("The Ancient Blue Ledger")).toBeVisible();
  await expect(page.getByRole("button", { name: /close settings/i })).toBeFocused();
});

test("states the role in the home heading before the API resolves", async ({ page }) => {
  const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
  // The heading must not wait for /api/home, so the response is held open.
  await page.route("**/api/home**", () => {});
  await page.route("**/api/snippets**", (route) =>
    route.fulfill({ status: 200, headers, body: '{"data":[]}' }),
  );

  await page.goto("/");

  const h1 = page.locator("h1");
  await expect(h1).toHaveCount(1);
  await expect(h1).toContainText(/software developer/i);
});

test("serves project media through the edge transform at a fixed width", async ({ page }) => {
  await stubApi(page);
  await page.goto("/projects");

  const cards = page.locator(".project-archive-row");
  await expect(cards).toHaveCount(8); // seven records plus the future card

  const images = page.locator(".project-archive-media img");
  const count = await images.count();
  assert.ok(count >= 7, "one image per record");

  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    const src = await image.getAttribute("src");
    if (src?.startsWith("https://placehold.co")) {
      // The future card is deliberately not transformed, and carries no hints.
      expect(await image.getAttribute("width")).toBeNull();
      expect(await image.getAttribute("loading")).toBeNull();
      continue;
    }

    expect(src).toContain("/cdn-cgi/image/width=1360,format=auto,quality=78/");
    expect(await image.getAttribute("width")).toBe("540");
    expect(await image.getAttribute("height")).toBe("200");
  }
});

test("lazily loads project images below the fold and prioritises the portrait", async ({
  page,
}) => {
  await stubApi(page);
  await page.goto("/projects");
  // Wait for the archive's first image before reading attributes: an unawaited
  // evaluateAll on a still-loading page returns an empty list and proves nothing.
  await expect(page.locator(".project-archive-media img").first()).toBeVisible();

  const hints = await page
    .locator(".project-archive-media img")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("loading") ?? "none"),
    );

  expect(hints.slice(0, 2)).toEqual(["eager", "eager"]);
  expect(hints.slice(2)).toContain("lazy");
  // The future card carries no hint because it was never transformed.
  expect(hints.filter((hint) => hint === "eager")).toHaveLength(2);

  await page.goto("/");
  const portrait = page.locator(".homepage-profile-image img");
  await expect(portrait).toHaveAttribute(
    "src",
    /\/cdn-cgi\/image\/width=360,format=auto,quality=78\//,
  );
  await expect(portrait).toHaveAttribute("fetchpriority", "high");
  await expect(portrait).toHaveAttribute("alt", /Ada Lovelace/);
});

test("falls back to the original object when the transform fails", async ({ page }) => {
  await stubApi(page);
  let transformRequests = 0;
  await page.route("**/cdn-cgi/image/**", (route) => {
    transformRequests += 1;
    return route.abort();
  });

  await page.goto("/projects");

  const first = page.locator(".project-archive-media img").first();
  await expect(first).toHaveAttribute("src", /\/Projects\/fixture\.png$/);
  await expect(first).toHaveAttribute("src", /^(?!.*cdn-cgi)/);

  // The image decoded, and no further transform was requested after the swap.
  const decoded = await first.evaluate((element) => (element as HTMLImageElement).naturalWidth > 0);
  expect(decoded, "the fallback object was served and decoded").toBe(true);

  const settled = transformRequests;
  await page.waitForTimeout(250);
  expect(transformRequests).toBe(settled);
});

test("normalises every certificate image to one canvas", async ({ page }) => {
  await stubApi(page);
  await page.goto("/certificates");
  await expect(page.locator(".certificate-archive-card").first()).toBeAttached();

  const images = page.locator(".certificate-archive-media img");
  const count = await images.count();
  assert.ok(count >= 8, "one image per certificate");

  let transformed = 0;
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    const src = (await image.getAttribute("src")) ?? "";

    if (src.startsWith("https://placehold.co")) {
      // The "still cooking" card is a foreign host the helper refuses, so it carries
      // none of the normalisation attributes.
      expect(await image.getAttribute("width")).toBeNull();
      expect(await image.getAttribute("loading")).toBeNull();
      continue;
    }

    transformed += 1;
    expect(src).toContain(
      "/cdn-cgi/image/width=768,height=569,fit=pad,background=transparent,format=auto,quality=78/",
    );
    expect(await image.getAttribute("width")).toBe("768");
    expect(await image.getAttribute("height")).toBe("569");
    expect(await image.getAttribute("srcset")).toBeNull();
    expect(await image.getAttribute("loading")).toBe("lazy");
  }

  assert.ok(transformed >= 8, "every API certificate is normalised");
});

/**
 * Reloading the archive keeps the reader's position.
 *
 * The bug: the browser restored the offset against the loading skeleton, which is shorter
 * than the finished page, so the offset clamped to the document maximum and the reader
 * landed on the footer. The archive now owns restoration and applies it after its rows exist.
 */
test("keeps the reader's position across a reload instead of pinning the bottom", async ({
  page,
}) => {
  await stubApi(page, { projects: buildProjects(12) });
  await page.goto("/projects", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const maxOffset = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(maxOffset).toBeGreaterThan(600);

  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => Math.round(window.scrollY));
  expect(before).toBe(500);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => Math.round(window.scrollY));
  const reloadedMax = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
  expect(after).toBeLessThan(reloadedMax - 8);
});

test("a reader who left at the very bottom stays at the bottom after reload", async ({ page }) => {
  await stubApi(page, { projects: buildProjects(12) });
  await page.goto("/projects", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(400);

  const beforeReload = await page.evaluate(() => Math.round(window.scrollY));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const afterReload = await page.evaluate(() => Math.round(window.scrollY));
  expect(Math.abs(afterReload - beforeReload)).toBeLessThanOrEqual(8);
});
