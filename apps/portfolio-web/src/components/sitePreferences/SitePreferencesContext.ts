import { createContext } from "react";
import type { CustomThemeDocument } from "../../preferences/customTheme";
import type { MotionPreference, SiteTheme } from "../../preferences/sitePreferences";

export interface SitePreferencesContextValue {
  theme: SiteTheme;
  motionPreference: MotionPreference;
  effectiveReducedMotion: boolean;
  systemReducedMotion: boolean;
  customTheme: CustomThemeDocument | null;
  setTheme: (theme: SiteTheme) => void;
  setCustomTheme: (theme: CustomThemeDocument) => void;
  clearCustomTheme: () => void;
  setMotionPreference: (preference: MotionPreference) => void;
}

export const SitePreferencesContext = createContext<SitePreferencesContextValue | null>(null);
