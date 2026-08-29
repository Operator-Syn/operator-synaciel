import { portfolioAssistantConfig } from "./portfolioAssistantConfig.ts";

export type PublicSession = {
  authenticated: boolean;
  user?: {
    sub: string;
    email: string;
    displayName: string | null;
  };
  sessionExpiresAt?: number;
  turnstileVerified?: boolean;
};

export type AssistantThread = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string | null;
};

export function getPublicAuthOrigin(): string {
  const origin = portfolioAssistantConfig.publicAuthOrigin;
  if (!origin) {
    throw new Error(
      "The local portfolio assistant is not configured. Set VITE_PUBLIC_AUTH_URL in the repository root .env.",
    );
  }
  return origin;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getPublicAuthOrigin()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      payload?.error?.message ?? "The assistant service could not complete that request.",
    );
  }
  return (await response.json()) as T;
}

export function getSession(): Promise<PublicSession> {
  return requestJson<PublicSession>("/session");
}

export function verifyTurnstile(token: string): Promise<{ verified: boolean }> {
  return requestJson<{ verified: boolean }>("/turnstile/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function listThreads(): Promise<{ threads: AssistantThread[] }> {
  return requestJson<{ threads: AssistantThread[] }>("/threads");
}

export function createThread(): Promise<AssistantThread> {
  return requestJson<AssistantThread>("/threads", {
    method: "POST",
    body: "{}",
  });
}

export function deleteThread(threadId: string): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(`/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    body: "{}",
  });
}

export function exportThread(threadId: string): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(`/threads/${encodeURIComponent(threadId)}/export`);
}

export function issueAgentToken(threadId: string): Promise<{ token: string; expiresAt: number }> {
  return requestJson<{ token: string; expiresAt: number }>("/agent/token", {
    method: "POST",
    body: JSON.stringify({ threadId }),
  });
}

export function signInUrl(returnTo: string): string {
  return `${getPublicAuthOrigin()}/oauth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function signOut(): Promise<void> {
  await requestJson("/logout", { method: "POST", body: "{}" });
}
