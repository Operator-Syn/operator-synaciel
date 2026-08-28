import { createContext } from "react";
import type { CustomThemeDocument } from "../../preferences/customTheme";
import type { SiteTheme } from "../../preferences/sitePreferences";

export interface SitePreferencesContextValue {
  theme: SiteTheme;
  reducedMotion: boolean;
  effectiveReducedMotion: boolean;
  systemReducedMotion: boolean;
  customTheme: CustomThemeDocument | null;
  setTheme: (theme: SiteTheme) => void;
  setCustomTheme: (theme: CustomThemeDocument) => void;
  clearCustomTheme: () => void;
  setReducedMotion: (enabled: boolean) => void;
}

export const SitePreferencesContext = createContext<SitePreferencesContextValue | null>(null);
