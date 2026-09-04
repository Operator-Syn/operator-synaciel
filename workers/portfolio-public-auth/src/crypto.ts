import { createRemoteJWKSet, jwtVerify } from "jose";
import { getConfigString, type PublicAuthEnvironment } from "./config.ts";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  displayName: string;
  pictureUrl: string | null;
};

export async function verifyGoogleIdToken(
  idToken: string,
  environment: PublicAuthEnvironment,
  nonce: string,
): Promise<GoogleIdentity> {
  const verified = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: getConfigString(environment, "GOOGLE", "CLIENT", "ID"),
  });
  const payload = verified.payload;
  if (payload.nonce !== nonce) throw new Error("Google nonce did not match the OAuth state.");
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw new Error("Google identity is missing a verified email.");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    displayName:
      typeof payload.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim().slice(0, 120)
        : payload.email,
    pictureUrl:
      typeof payload.picture === "string" && payload.picture.trim().length > 0
        ? payload.picture.trim().slice(0, 2_048)
        : null,
  };
}
