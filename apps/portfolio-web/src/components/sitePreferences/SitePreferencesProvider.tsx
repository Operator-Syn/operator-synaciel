import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CustomThemeDocument, serializeCustomTheme } from "../../preferences/customTheme";
import {
  applySitePreferences,
  CUSTOM_THEME_STORAGE_KEY,
  isSystemReducedMotion,
  persistSitePreferences,
  REDUCED_MOTION_STORAGE_KEY,
  readSitePreferences,
  SITE_THEME_STORAGE_KEY,
  type SiteTheme,
} from "../../preferences/sitePreferences";
import { SitePreferencesContext } from "./SitePreferencesContext";
import { createThemeTransitionController, type ThemeTransitionController } from "./themeTransition";

export default function SitePreferencesProvider({ children }: { children: ReactNode }) {
  const [{ theme, reducedMotion, customTheme }, setPreferences] = useState(readSitePreferences);
  const [systemReducedMotion, setSystemReducedMotion] = useState(isSystemReducedMotion);
  const [themeTransitionId, setThemeTransitionId] = useState<number | null>(null);
  const themeTransitionControllerRef = useRef<ThemeTransitionController | null>(null);
  const visualThemeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = createThemeTransitionController(
      document.documentElement,
      setThemeTransitionId,
    );
    themeTransitionControllerRef.current = controller;

    return () => {
      controller.cancel();
      themeTransitionControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const preferences = { theme, reducedMotion, customTheme };
    const visualThemeKey =
      theme === "custom" && customTheme
        ? `custom:${serializeCustomTheme(customTheme)}`
        : theme === "custom"
          ? "dalan"
          : theme;
    const shouldAnimate =
      visualThemeKeyRef.current !== null &&
      visualThemeKeyRef.current !== visualThemeKey &&
      !reducedMotion &&
      !systemReducedMotion;

    visualThemeKeyRef.current = visualThemeKey;
    persistSitePreferences(preferences);

    const controller = themeTransitionControllerRef.current;
    if (!controller) {
      applySitePreferences(preferences);
      return;
    }

    controller.start(() => applySitePreferences(preferences), shouldAnimate);
    return controller.cancel;
  }, [customTheme, reducedMotion, systemReducedMotion, theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setSystemReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== SITE_THEME_STORAGE_KEY &&
        event.key !== REDUCED_MOTION_STORAGE_KEY &&
        event.key !== CUSTOM_THEME_STORAGE_KEY
      ) {
        return;
      }

      const preferences = readSitePreferences(event.storageArea);
      setPreferences(preferences);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((nextTheme: SiteTheme) => {
    setPreferences((current) => {
      if (nextTheme === "custom" && !current.customTheme) return current;
      return current.theme === nextTheme ? current : { ...current, theme: nextTheme };
    });
  }, []);

  const setCustomTheme = useCallback((nextCustomTheme: CustomThemeDocument) => {
    setPreferences((current) => ({
      ...current,
      customTheme: nextCustomTheme,
      theme: "custom",
    }));
  }, []);

  const clearCustomTheme = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      customTheme: null,
      theme: current.theme === "custom" ? "dalan" : current.theme,
    }));
  }, []);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setPreferences((current) =>
      current.reducedMotion === enabled ? current : { ...current, reducedMotion: enabled },
    );
  }, []);

  const value = useMemo(
    () => ({
      theme,
      reducedMotion,
      effectiveReducedMotion: reducedMotion || systemReducedMotion,
      systemReducedMotion,
      customTheme,
      setTheme,
      setCustomTheme,
      clearCustomTheme,
      setReducedMotion,
    }),
    [
      clearCustomTheme,
      customTheme,
      reducedMotion,
      setCustomTheme,
      setReducedMotion,
      setTheme,
      systemReducedMotion,
      theme,
    ],
  );

  return (
    <SitePreferencesContext.Provider value={value}>
      {children}
      {themeTransitionId !== null && (
        <span aria-hidden="true" className="theme-transition-wipe" key={themeTransitionId} />
      )}
    </SitePreferencesContext.Provider>
  );
}
