import { expect, test } from "playwright/test";

test("reuses the saved Google session for the portfolio assistant", async ({ page }) => {
  await page.goto("/ai");
  await expect(page.getByRole("heading", { name: "Portfolio, readable by agents." })).toBeVisible();

  const sessionResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/session",
  );
  await page.getByRole("button", { name: "Open portfolio assistant" }).click();

  const sessionResponse = await sessionResponsePromise;
  expect(sessionResponse.status()).toBe(200);
  const session = (await sessionResponse.json()) as { authenticated?: unknown };
  expect(session.authenticated).toBe(true);

  const panel = page.locator("#portfolio-assistant-panel");
  await expect(panel).toHaveAttribute("data-chat-state", /^(turnstile|active)$/);
});

test("keeps the assistant contained and touch-sized across the responsive matrix", async ({
  page,
}) => {
  await page.goto("/ai");
  await page.getByRole("button", { name: "Open portfolio assistant" }).click();

  const panel = page.locator("#portfolio-assistant-panel");
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Playwright viewport is unavailable.");

  const isResponsiveModal = viewport.width <= 640 || viewport.height <= 560;
  if (isResponsiveModal) {
    await expect(panel).toHaveAttribute("role", "dialog");
    await expect(panel).toHaveAttribute("aria-modal", "true");
    await expect(page.locator(".portfolio-assistant-fab")).toHaveCount(0);
    await expect(page.locator(".portfolio-assistant-expanded-backdrop")).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "Expand portfolio assistant for reading" }),
    ).toHaveCount(0);

    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox?.x ?? -1).toBe(0);
    expect(panelBox?.y ?? -1).toBe(0);
    expect(panelBox?.width ?? 0).toBe(viewport.width);
    expect(panelBox?.height ?? 0).toBe(viewport.height);
  } else {
    await expect(panel).not.toHaveAttribute("role", "dialog");
    await expect(page.locator(".portfolio-assistant-fab")).toHaveCount(1);
  }

  const targets = await panel.locator("button, textarea").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }),
  );
  expect(targets.every(({ height, width }) => height >= 44 && width >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    viewport.width,
  );

  const state = await panel.getAttribute("data-chat-state");
  if (state !== "active") return;

  const rows = await panel
    .locator(
      ".portfolio-assistant-header, .portfolio-assistant-toolbar, .portfolio-assistant-transcript-shell, .portfolio-assistant-composer, .portfolio-assistant-quota, .portfolio-assistant-status",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { bottom: rect.bottom, top: rect.top };
        }),
    );
  expect(rows.every((row, index) => index === 0 || row.top >= rows[index - 1].bottom - 1)).toBe(
    true,
  );

  const transcript = panel.locator(".portfolio-assistant-transcript");
  const transcriptBox = await transcript.boundingBox();
  expect(transcriptBox).not.toBeNull();
  expect(transcriptBox?.height ?? 0).toBeGreaterThanOrEqual(viewport.height * 0.45);
  const composer = panel.locator(".portfolio-assistant-composer textarea");
  await expect(composer).toBeVisible();
  await composer.focus();
  await expect(composer).toBeFocused();

  const pageScrollTop = await page.evaluate(() => window.scrollY);
  const transcriptScroll = await transcript.evaluate((element) => {
    const before = element.scrollTop;
    element.scrollTop = Math.min(element.scrollHeight - element.clientHeight, 120);
    return {
      before,
      after: element.scrollTop,
      canScroll: element.scrollHeight > element.clientHeight,
    };
  });
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollTop);
  if (transcriptScroll.canScroll)
    expect(transcriptScroll.after).toBeGreaterThan(transcriptScroll.before);
});
