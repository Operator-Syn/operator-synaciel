import {
  applyCustomThemeColors,
  CUSTOM_THEME_STORAGE_KEY as CUSTOM_THEME_KEY,
  type CustomThemeDocument,
  clearCustomThemeColors,
  parseCustomThemeDocument,
  serializeCustomTheme,
} from "./customTheme";

export { CUSTOM_THEME_STORAGE_KEY } from "./customTheme";

export const SITE_THEME_STORAGE_KEY = "operator-syn:theme";
export const REDUCED_MOTION_STORAGE_KEY = "operator-syn:reduced-motion";

export const DEFAULT_SITE_THEME = "dalan" as const;
export type SiteTheme = "dalan" | "of-times-old" | "vesper-index" | "custom";
export type ReducedMotionPreference = "on" | "off";

export interface StoredSitePreferences {
  theme: SiteTheme;
  reducedMotion: boolean;
  customTheme: CustomThemeDocument | null;
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isSiteTheme(value: unknown): value is SiteTheme {
  return (
    value === "dalan" || value === "of-times-old" || value === "vesper-index" || value === "custom"
  );
}

export function readSitePreferences(
  storage: Storage | null = getLocalStorage(),
): StoredSitePreferences {
  let storedTheme: string | null = null;
  let storedMotion: string | null = null;
  let storedCustomTheme: string | null = null;

  try {
    storedTheme = storage?.getItem(SITE_THEME_STORAGE_KEY) ?? null;
    storedMotion = storage?.getItem(REDUCED_MOTION_STORAGE_KEY) ?? null;
    storedCustomTheme = storage?.getItem(CUSTOM_THEME_KEY) ?? null;
  } catch {
    // Private browsing and restricted storage fall back to the defaults.
  }

  const parsedCustomTheme =
    storedCustomTheme === null ? null : parseCustomThemeDocument(storedCustomTheme);
  const customTheme = parsedCustomTheme?.ok ? parsedCustomTheme.theme : null;

  if (storedCustomTheme !== null && !customTheme) {
    try {
      storage?.removeItem(CUSTOM_THEME_KEY);
    } catch {
      // Invalid persisted data is ignored when storage is restricted.
    }
  }

  const storedSiteTheme = isSiteTheme(storedTheme) ? storedTheme : DEFAULT_SITE_THEME;
  const theme = storedSiteTheme === "custom" && !customTheme ? DEFAULT_SITE_THEME : storedSiteTheme;

  return {
    theme,
    reducedMotion: storedMotion === "on",
    customTheme,
  };
}

export function persistSitePreferences(
  preferences: StoredSitePreferences,
  storage: Storage | null = getLocalStorage(),
) {
  try {
    storage?.setItem(SITE_THEME_STORAGE_KEY, preferences.theme);
    storage?.setItem(REDUCED_MOTION_STORAGE_KEY, preferences.reducedMotion ? "on" : "off");

    if (preferences.customTheme) {
      storage?.setItem(CUSTOM_THEME_KEY, serializeCustomTheme(preferences.customTheme));
    } else {
      storage?.removeItem(CUSTOM_THEME_KEY);
    }
  } catch {
    // Preferences remain available for the current session when storage is unavailable.
  }
}

export function applySitePreferences(
  preferences: StoredSitePreferences,
  root: HTMLElement | null = typeof document === "undefined" ? null : document.documentElement,
) {
  if (!root) return;

  clearCustomThemeColors(root);

  if (preferences.theme === "custom" && preferences.customTheme) {
    root.dataset.theme = "custom";
    applyCustomThemeColors(root, preferences.customTheme);
  } else {
    root.dataset.theme = preferences.theme === "custom" ? DEFAULT_SITE_THEME : preferences.theme;
  }

  if (preferences.reducedMotion) {
    root.dataset.reducedMotion = "on";
  } else {
    delete root.dataset.reducedMotion;
  }
}

export function initializeSitePreferences() {
  const preferences = readSitePreferences();
  applySitePreferences(preferences);
  return preferences;
}

export function isSystemReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function isReducedMotionEnabled() {
  const explicitPreference =
    typeof document !== "undefined" && document.documentElement.dataset.reducedMotion === "on";

  return explicitPreference || isSystemReducedMotion();
}
