export type AssistantBuildEnvironment = {
  DEV?: boolean;
  MODE?: string;
  VITE_PUBLIC_AUTH_URL?: string;
  VITE_PORTFOLIO_AGENT_URL?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
};

export type PortfolioAssistantConfig = {
  publicAuthOrigin: string | null;
  agentOrigin: string | null;
  turnstileSiteKey: string | null;
  configurationError: string | null;
};

const PRODUCTION_PUBLIC_AUTH_ORIGIN = "https://public-auth.syn-forge.com";
const PRODUCTION_AGENT_ORIGIN = "https://assistant.syn-forge.com";

function normalizeHttpOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveOrigin(
  value: string | undefined,
  key: string,
  fallback: string | null,
  isDevelopment: boolean,
  errors: string[],
): string | null {
  const trimmed = value?.trim();
  if (trimmed) {
    const origin = normalizeHttpOrigin(trimmed);
    if (!origin) errors.push(`${key} must be an http(s) origin without a path.`);
    return origin;
  }
  if (isDevelopment) {
    errors.push(`${key} is required for local development.`);
    return null;
  }
  return fallback;
}

export function resolvePortfolioAssistantConfig(
  environment: AssistantBuildEnvironment,
): PortfolioAssistantConfig {
  const isDevelopment = environment.DEV === true || environment.MODE === "development";
  const errors: string[] = [];
  const publicAuthOrigin = resolveOrigin(
    environment.VITE_PUBLIC_AUTH_URL,
    "VITE_PUBLIC_AUTH_URL",
    PRODUCTION_PUBLIC_AUTH_ORIGIN,
    isDevelopment,
    errors,
  );
  const agentOrigin = resolveOrigin(
    environment.VITE_PORTFOLIO_AGENT_URL,
    "VITE_PORTFOLIO_AGENT_URL",
    PRODUCTION_AGENT_ORIGIN,
    isDevelopment,
    errors,
  );
  const turnstileSiteKey = environment.VITE_TURNSTILE_SITE_KEY?.trim() || null;

  return {
    publicAuthOrigin,
    agentOrigin,
    turnstileSiteKey,
    configurationError:
      errors.length > 0
        ? `Portfolio assistant configuration is invalid: ${errors.join(" ")}`
        : null,
  };
}

const viteEnvironment: AssistantBuildEnvironment = {
  DEV: import.meta.env?.DEV,
  MODE: import.meta.env?.MODE,
  VITE_PUBLIC_AUTH_URL: import.meta.env?.VITE_PUBLIC_AUTH_URL,
  VITE_PORTFOLIO_AGENT_URL: import.meta.env?.VITE_PORTFOLIO_AGENT_URL,
  VITE_TURNSTILE_SITE_KEY: import.meta.env?.VITE_TURNSTILE_SITE_KEY,
};

export const portfolioAssistantConfig = resolvePortfolioAssistantConfig(viteEnvironment);
