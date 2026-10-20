import { type APIRequestContext, expect, test } from "playwright/test";
import { installAssistantBrowserAudit } from "./playwright-observability.ts";

const DEFAULT_PUBLIC_AUTH_ORIGIN = "https://public-auth.syn-forge.com";
const FALLBACK_PATTERN = /couldn['’]t verify|unable to verify|not enough evidence/i;
const REDIRECT_PATTERN = /which (?:approach|flow|option)|should i (?:fetch|read|check|look)/i;
const INTERNAL_TOOL_PATTERN = /read_portfolio_page|tool_[a-z0-9_]+/i;

type ThreadRecord = { id?: unknown };

type ThreadListResponse = { threads?: unknown };

type MessageListResponse = { messages?: unknown };

function publicAuthOrigin(): string {
  const configured = process.env.E2E_PUBLIC_AUTH_URL?.trim() || DEFAULT_PUBLIC_AUTH_ORIGIN;
  return new URL(configured).origin;
}

async function threadIds(request: APIRequestContext, authOrigin: string, origin: string) {
  const response = await request.get(`${authOrigin}/threads`, {
    headers: { Origin: origin },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as ThreadListResponse;
  if (!Array.isArray(payload.threads)) return [];
  return payload.threads.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const id = (candidate as ThreadRecord).id;
    return typeof id === "string" && id ? [id] : [];
  });
}

async function findEmptyThread(
  request: APIRequestContext,
  authOrigin: string,
  origin: string,
): Promise<string | null> {
  for (const id of await threadIds(request, authOrigin, origin)) {
    const response = await request.get(
      `${authOrigin}/threads/${encodeURIComponent(id)}/messages?limit=1`,
      {
        headers: { Origin: origin },
      },
    );
    if (!response.ok()) continue;
    const payload = (await response.json()) as MessageListResponse;
    if (Array.isArray(payload.messages) && payload.messages.length === 0) return id;
  }
  return null;
}

async function ensureFreshThread(
  request: APIRequestContext,
  authOrigin: string,
  origin: string,
): Promise<string> {
  const existing = await findEmptyThread(request, authOrigin, origin);
  if (existing) return existing;

  const response = await request.post(`${authOrigin}/threads`, {
    headers: { Origin: origin },
  });
  expect(response.status()).toBe(201);
  const payload = (await response.json()) as ThreadRecord;
  expect(typeof payload.id).toBe("string");
  return payload.id as string;
}

async function deleteThread(
  request: APIRequestContext,
  authOrigin: string,
  origin: string,
  threadId: string,
): Promise<void> {
  await request.delete(`${authOrigin}/threads/${encodeURIComponent(threadId)}`, {
    headers: { Origin: origin },
  });
}

async function ask(panel: import("playwright/test").Locator, question: string): Promise<string> {
  const assistantMessages = panel.locator("article.portfolio-assistant-message.assistant");
  const sourceDisclosures = panel.locator(".portfolio-assistant-source-disclosure");
  const beforeMessages = await assistantMessages.count();
  const beforeSources = await sourceDisclosures.count();
  const composer = panel.locator(".portfolio-assistant-composer textarea");

  await composer.fill(question);
  await panel.getByRole("button", { name: "Send portfolio question" }).click();
  await expect
    .poll(
      async () => {
        const error = panel.locator(".portfolio-assistant-chat-error");
        if (await error.count()) return `error: ${await error.innerText()}`;
        if ((await assistantMessages.count()) <= beforeMessages) return "pending";
        if ((await sourceDisclosures.count()) <= beforeSources) return "pending";
        return "ready";
      },
      { timeout: 120_000 },
    )
    .toBe("ready");

  const latest = assistantMessages.nth(beforeMessages);
  const answer = latest.locator(".portfolio-assistant-message-markdown");
  await expect(answer).toBeVisible();
  const text = await answer.innerText();
  expect(text).not.toMatch(FALLBACK_PATTERN);
  return text;
}

test.describe("live agent context replay", () => {
  test.skip(
    process.env.PLAYWRIGHT_LIVE_AGENT_REPLAY !== "1",
    "Set PLAYWRIGHT_LIVE_AGENT_REPLAY=1 only for the approval-gated context replay.",
  );

  test("replays portfolio context reliability prompts against the live agent", async ({ page }) => {
    test.setTimeout(480_000);

    const audit = installAssistantBrowserAudit(page);
    await page.goto("/ai");
    const origin = new URL(page.url()).origin;
    const authOrigin = publicAuthOrigin();
    const request = page.context().request;
    const threadId = await ensureFreshThread(request, authOrigin, origin);

    try {
      await page.getByRole("button", { name: "Open portfolio assistant" }).click();
      const panel = page.locator("#portfolio-assistant-panel");
      await expect(panel).toHaveAttribute("data-chat-state", "active");
      const threadTrigger = panel.locator(".portfolio-assistant-thread-select-trigger");
      await expect(threadTrigger).toBeVisible();
      await threadTrigger.click();
      const threadPrefix = `Thread ${threadId.slice(0, 6)}`;
      await panel.getByRole("option", { name: new RegExp(threadPrefix) }).click();
      await expect(threadTrigger).toHaveAttribute("aria-label", new RegExp(threadPrefix));

      const aiPageAnswer = await ask(panel, "What is the /ai page about?");
      expect(aiPageAnswer).toMatch(/mcp/i);
      expect(aiPageAnswer).toMatch(/public|read[- ]only/i);
      expect(aiPageAnswer).not.toMatch(REDIRECT_PATTERN);

      const pagesAnswer = await ask(panel, "What other pages does this site have?");
      for (const label of ["projects", "certificates", "snippets", "ai"]) {
        expect(pagesAnswer.toLowerCase()).toContain(label);
      }
      expect(pagesAnswer).not.toMatch(REDIRECT_PATTERN);

      const onboardingAnswer = await ask(
        panel,
        "I’m a visitor and don’t know anything about this site. Onboard me.",
      );
      expect(onboardingAnswer.toLowerCase()).toContain("projects");
      expect(onboardingAnswer.toLowerCase()).toContain("snippets");
      expect(onboardingAnswer).not.toMatch(REDIRECT_PATTERN);

      const snippetsAnswer = await ask(panel, "I thought snippets were blogs. Are they?");
      expect(snippetsAnswer.toLowerCase()).toContain("snippet");
      expect(snippetsAnswer).toMatch(/technical|notes|files?|documents?/i);

      const projectsJsonAnswer = await ask(panel, "List all projects in JSON format.");
      const fenced = projectsJsonAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
      const candidate = fenced ?? projectsJsonAnswer.trim();
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        expect(parsed.length).toBeGreaterThan(0);
      } else {
        expect(parsed).not.toBeNull();
        expect(typeof parsed).toBe("object");
      }

      for (const answer of [aiPageAnswer, pagesAnswer, onboardingAnswer, snippetsAnswer]) {
        expect(answer).not.toMatch(INTERNAL_TOOL_PATTERN);
      }
      audit.assertClean();
    } finally {
      await deleteThread(request, authOrigin, origin, threadId);
    }
  });
});
