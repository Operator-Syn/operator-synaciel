import { useContext } from "react";
import { SitePreferencesContext } from "./SitePreferencesContext";

export default function useSitePreferences() {
  const context = useContext(SitePreferencesContext);

  if (!context) {
    throw new Error("useSitePreferences must be used within SitePreferencesProvider");
  }

  return context;
}
