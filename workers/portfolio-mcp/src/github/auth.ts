import { importPKCS8, SignJWT } from "jose";
import type { PortfolioMcpEnvironment } from "../config.ts";
import { PortfolioApiError } from "../portfolio-api/errors.ts";

const GITHUB_API_ORIGIN = "https://api.github.com";
const GITHUB_USER_AGENT = "syn-forge-portfolio-mcp";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TOKEN_RESPONSE_BYTES = 64 * 1_024;
const JWT_LIFETIME_SECONDS = 9 * 60;
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1_000;

const NUMERIC_ID_PATTERN = /^[1-9][0-9]*$/;

export type GitHubCredentialProvider = {
  getToken(): Promise<string>;
  invalidate(token: string): void;
};

export type GitHubCredentialProviderOptions = {
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  now?: () => number;
};

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

type TokenResponse = {
  token?: unknown;
  expires_at?: unknown;
};

function requiredConfig(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PortfolioApiError(`${label} is not configured.`, 502);
  }
  return value.trim();
}

function numericConfig(value: unknown, label: string): string {
  const normalized = requiredConfig(value, label);
  if (!NUMERIC_ID_PATTERN.test(normalized)) {
    throw new PortfolioApiError(`${label} is invalid.`, 502);
  }
  return normalized;
}

function keyEnvelopeMarker(label: string, boundary: "BEGIN" | "END"): string {
  return `-----${boundary} ${label}-----`;
}

function decodePemBody(value: string, label: string): Uint8Array {
  const match = new RegExp(
    `${keyEnvelopeMarker(label, "BEGIN")}\\s*([\\s\\S]*?)\\s*${keyEnvelopeMarker(label, "END")}`,
  ).exec(value);
  if (!match?.[1]) throw new Error("Missing PEM body.");
  try {
    const binary = atob(match[1].replace(/\s/g, ""));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Invalid PEM body.");
  }
}

function derLength(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid DER length.");
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(
    0x30,
    0x0d,
    0x06,
    0x09,
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x01,
    0x01,
    0x01,
    0x05,
    0x00,
  );
  const privateKey = concatBytes(Uint8Array.of(0x04), derLength(pkcs1.byteLength), pkcs1);
  const content = concatBytes(version, rsaAlgorithm, privateKey);
  return concatBytes(Uint8Array.of(0x30), derLength(content.byteLength), content);
}

function encodePem(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const lines = (btoa(binary).match(/.{1,64}/g) ?? []).join("\n");
  return `${keyEnvelopeMarker("PRIVATE KEY", "BEGIN")}\n${lines}\n${keyEnvelopeMarker("PRIVATE KEY", "END")}`;
}

function normalizePrivateKey(value: unknown): string {
  const normalized = requiredConfig(value, "GitHub App private key").replace(/\\n/g, "\n");
  const pkcs8Begin = keyEnvelopeMarker("PRIVATE KEY", "BEGIN");
  const pkcs8End = keyEnvelopeMarker("PRIVATE KEY", "END");
  if (normalized.includes(pkcs8Begin) && normalized.includes(pkcs8End)) return normalized;

  const rsaLabel = "RSA PRIVATE KEY";
  if (
    normalized.includes(keyEnvelopeMarker(rsaLabel, "BEGIN")) &&
    normalized.includes(keyEnvelopeMarker(rsaLabel, "END"))
  ) {
    try {
      return encodePem(pkcs1ToPkcs8(decodePemBody(normalized, rsaLabel)));
    } catch {
      throw new PortfolioApiError("GitHub App private key is invalid.", 502);
    }
  }
  throw new PortfolioApiError("GitHub App private key is invalid.", 502);
}

function tokenEndpoint(installationId: string): string {
  return `/app/installations/${installationId}/access_tokens`;
}

async function readTokenResponse<T>(response: Response): Promise<T> {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_TOKEN_RESPONSE_BYTES) {
    throw new PortfolioApiError("GitHub authentication response is oversized.", 502);
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new PortfolioApiError("GitHub authentication returned invalid JSON.", 502);
  }
}

function tokenExchangeStatus(response: Response): number {
  if (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  ) {
    return 429;
  }
  return 502;
}

/**
 * Keep GitHub App credentials inside the Worker. The provider is lazy so
 * non-GitHub MCP tools remain usable when local GitHub credentials are absent.
 */
export function createGitHubAppCredentialProvider(
  environment: PortfolioMcpEnvironment,
  options: GitHubCredentialProviderOptions = {},
): GitHubCredentialProvider {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? Date.now;
  let cached: CachedToken | null = null;
  let refresh: Promise<string> | null = null;
  let signingKey: Promise<CryptoKey> | null = null;

  async function getSigningKey(): Promise<CryptoKey> {
    if (!signingKey) {
      signingKey = importPKCS8(
        normalizePrivateKey(environment.GITHUB_APP_PRIVATE_KEY),
        "RS256",
      ).catch(() => {
        signingKey = null;
        throw new PortfolioApiError("GitHub App private key is invalid.", 502);
      });
    }
    return signingKey;
  }

  async function createAppJwt(appId: string, issuedAtMs: number): Promise<string> {
    const issuedAt = Math.floor(issuedAtMs / 1_000);
    try {
      return await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuedAt(issuedAt - 60)
        .setExpirationTime(issuedAt + JWT_LIFETIME_SECONDS)
        .setIssuer(appId)
        .sign(await getSigningKey());
    } catch (error) {
      if (error instanceof PortfolioApiError) throw error;
      throw new PortfolioApiError("GitHub App authentication could not be prepared.", 502);
    }
  }

  async function exchangeInstallationToken(): Promise<CachedToken> {
    const appId = numericConfig(environment.GITHUB_APP_ID, "GitHub App ID");
    const installationId = numericConfig(
      environment.GITHUB_INSTALLATION_ID,
      "GitHub App installation ID",
    );
    const requestedAt = now();
    const jwt = await createAppJwt(appId, requestedAt);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetchImpl(new URL(tokenEndpoint(installationId), GITHUB_API_ORIGIN), {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "User-Agent": GITHUB_USER_AGENT,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new PortfolioApiError(
          `GitHub authentication failed (${String(response.status)}).`,
          tokenExchangeStatus(response),
        );
      }

      const payload = await readTokenResponse<TokenResponse>(response);
      if (typeof payload.token !== "string" || payload.token.trim().length === 0) {
        throw new PortfolioApiError("GitHub authentication returned no token.", 502);
      }
      if (typeof payload.expires_at !== "string") {
        throw new PortfolioApiError("GitHub authentication returned no expiry.", 502);
      }
      const expiresAtMs = Date.parse(payload.expires_at);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now()) {
        throw new PortfolioApiError("GitHub authentication returned an expired token.", 502);
      }
      return { token: payload.token.trim(), expiresAtMs };
    } catch (error) {
      if (error instanceof PortfolioApiError) throw error;
      throw new PortfolioApiError("GitHub authentication is temporarily unavailable.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getToken(): Promise<string> {
    const currentTime = now();
    if (cached && cached.expiresAtMs - currentTime > TOKEN_REFRESH_SKEW_MS) {
      return cached.token;
    }
    if (!refresh) {
      refresh = exchangeInstallationToken()
        .then((next) => {
          cached = next;
          return next.token;
        })
        .finally(() => {
          refresh = null;
        });
    }
    return refresh;
  }

  function invalidate(token: string): void {
    if (cached?.token === token) cached = null;
  }

  return { getToken, invalidate };
}
