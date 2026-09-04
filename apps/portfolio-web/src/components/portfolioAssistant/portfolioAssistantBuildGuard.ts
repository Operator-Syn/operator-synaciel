export function assertPagesBuildHasTurnstileSiteKey({
  isPagesBuild,
  mode,
  siteKey,
}: {
  isPagesBuild: boolean;
  mode: string;
  siteKey?: string;
}): void {
  if (isPagesBuild && mode === "production" && !siteKey?.trim()) {
    throw new Error("VITE_TURNSTILE_SITE_KEY is required for Cloudflare Pages production builds.");
  }
}
