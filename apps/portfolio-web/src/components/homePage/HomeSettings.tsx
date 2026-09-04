import { Download, RotateCcw, Settings2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  CUSTOM_THEME_MAX_BYTES,
  type CustomThemeDocument,
  type CustomThemeParseIssue,
  type CustomThemeSuggestion,
  createCustomThemeTemplate,
  parseCustomThemeDocument,
  serializeCustomTheme,
} from "../../preferences/customTheme";
import type { SiteTheme } from "../../preferences/sitePreferences";
import { useFloatingControls } from "../floatingControls/useFloatingControls";
import useSitePreferences from "../sitePreferences/useSitePreferences";

const builtInThemeChoices: Array<{ label: string; value: SiteTheme }> = [
  { label: "Dalan", value: "dalan" },
  { label: "Of Times Old", value: "of-times-old" },
  { label: "Vesper Index", value: "vesper-index" },
  { label: "The Ancient Blue Ledger", value: "ancient-blue-ledger" },
];

function downloadThemeDocument(content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "operator-syn-custom-theme.json";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function HomeSettingsPanel() {
  const {
    clearCustomTheme,
    customTheme,
    effectiveReducedMotion,
    reducedMotion,
    setCustomTheme,
    setReducedMotion,
    setTheme,
    systemReducedMotion,
    theme,
  } = useSitePreferences();
  const { activePanel, closePanel, openPanel } = useFloatingControls();
  const isOpen = activePanel === "settings";
  const [announcement, setAnnouncement] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const panelScrollRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customJson, setCustomJson] = useState(() =>
    customTheme ? serializeCustomTheme(customTheme) : createCustomThemeTemplate(),
  );
  const [customDraft, setCustomDraft] = useState<CustomThemeDocument | null>(() => {
    const initial = customTheme ? serializeCustomTheme(customTheme) : createCustomThemeTemplate();
    const result = parseCustomThemeDocument(initial);
    return result.ok ? result.theme : null;
  });
  const [customIssues, setCustomIssues] = useState<CustomThemeParseIssue[]>([]);
  const [customSuggestions, setCustomSuggestions] = useState<CustomThemeSuggestion[]>([]);
  const themeChoices: Array<{ label: string; value: SiteTheme }> = [
    ...builtInThemeChoices,
    ...(customTheme ? [{ label: customTheme.name, value: "custom" as const }] : []),
  ];

  const updateCustomDraft = useCallback((value: string) => {
    setCustomJson(value);
    const result = parseCustomThemeDocument(value);

    if (result.ok) {
      setCustomDraft(result.theme);
      setCustomIssues([]);
      setCustomSuggestions(result.suggestions);
    } else {
      setCustomDraft(null);
      setCustomIssues(result.issues);
      setCustomSuggestions([]);
    }
  }, []);

  const closeSettings = useCallback(() => {
    closePanel("settings");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [closePanel]);

  useEffect(() => {
    return () => closePanel("settings");
  }, [closePanel]);

  useEffect(() => {
    const nextJson = customTheme ? serializeCustomTheme(customTheme) : createCustomThemeTemplate();
    updateCustomDraft(nextJson);
  }, [customTheme, updateCustomDraft]);

  useEffect(() => {
    if (!isOpen) return;

    panelScrollRef.current?.scrollTo({ top: 0 });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      closeSettings();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      closeSettings();
    };

    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    });

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closeSettings, isOpen]);

  const handleThemeChange = (nextTheme: SiteTheme) => {
    setTheme(nextTheme);
    const label = themeChoices.find((choice) => choice.value === nextTheme)?.label ?? nextTheme;
    setAnnouncement(`Color scheme changed to ${label}.`);
  };

  const handleMotionChange = (enabled: boolean) => {
    setReducedMotion(enabled);
    setAnnouncement(`Reduced motion ${enabled ? "enabled" : "disabled"}.`);
  };

  const handleCustomFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (file.size > CUSTOM_THEME_MAX_BYTES) {
      updateCustomDraft("");
      setCustomIssues([{ path: "file", message: "Theme file must be 16 KB or smaller." }]);
      setAnnouncement("Custom theme file is too large.");
      return;
    }

    try {
      updateCustomDraft(await file.text());
      setAnnouncement("Custom theme file loaded. Review it before applying.");
    } catch {
      updateCustomDraft("");
      setCustomIssues([{ path: "file", message: "The theme file could not be read." }]);
      setAnnouncement("Custom theme file could not be read.");
    }
  };

  const handleApplyCustomTheme = () => {
    if (!customDraft) return;

    setCustomTheme(customDraft);
    setAnnouncement(
      customSuggestions.length > 0
        ? `Custom color scheme ${customDraft.name} applied. Readability suggestions are advisory.`
        : `Custom color scheme ${customDraft.name} applied.`,
    );
  };

  const handleDownloadTemplate = () => {
    downloadThemeDocument(createCustomThemeTemplate());
    setAnnouncement("Custom theme template downloaded.");
  };

  const handleExportCustomTheme = () => {
    if (!customTheme) return;

    downloadThemeDocument(serializeCustomTheme(customTheme));
    setAnnouncement("Custom theme exported.");
  };

  const handleResetCustomTheme = () => {
    clearCustomTheme();
    updateCustomDraft(createCustomThemeTemplate());
    setAnnouncement("Custom theme reset to Dalan.");
  };

  const customFeedbackIds = [
    customIssues.length > 0 ? "home-settings-custom-errors" : null,
    customSuggestions.length > 0 ? "home-settings-custom-suggestions" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="home-settings" data-floating-panel="settings" ref={panelRef}>
      <section
        aria-hidden={!isOpen}
        aria-labelledby="home-settings-title"
        className="home-settings-panel"
        data-effective-motion={effectiveReducedMotion ? "reduced" : "full"}
        data-state={isOpen ? "open" : "closed"}
        id="home-settings-panel"
        inert={!isOpen}
        ref={panelScrollRef}
      >
        <div className="home-settings-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2 id="home-settings-title">Interface settings</h2>
          </div>
          <button
            aria-label="Close settings"
            className="home-settings-close"
            data-settings-close="true"
            onClick={closeSettings}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>

        <fieldset className="home-settings-fieldset">
          <legend>Color scheme</legend>
          <div className="home-settings-options">
            {themeChoices.map((choice) => (
              <label
                className={`home-settings-choice${theme === choice.value ? " is-selected" : ""}`}
                key={choice.value}
              >
                <input
                  checked={theme === choice.value}
                  name="site-theme"
                  onChange={() => handleThemeChange(choice.value)}
                  type="radio"
                  value={choice.value}
                />
                <span>{choice.label}</span>
                {theme === choice.value && (
                  <span aria-hidden="true" className="home-settings-choice-state">
                    Active
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="home-settings-fieldset">
          <legend>Motion</legend>
          <label className="home-settings-choice">
            <input
              checked={reducedMotion}
              onChange={(event) => handleMotionChange(event.target.checked)}
              type="checkbox"
            />
            <span>Reduced motion</span>
            <span className="home-settings-choice-state">{reducedMotion ? "On" : "Off"}</span>
          </label>
          {(reducedMotion || systemReducedMotion) && (
            <p className="home-settings-note">
              Page wipes and animated feedback are disabled while reduced motion is active. Static
              cursor cues remain available.
            </p>
          )}
        </fieldset>

        <fieldset className="home-settings-fieldset home-settings-custom-fieldset">
          <legend>Custom theme</legend>
          <p className="home-settings-custom-description">
            Edit a safe JSON palette or load one from your device. Apply only when it is valid.
          </p>

          <label className="home-settings-json-label" htmlFor="home-settings-custom-json">
            <span>Theme document</span>
            <textarea
              aria-describedby={customFeedbackIds || undefined}
              aria-invalid={customIssues.length > 0}
              className="home-settings-json"
              id="home-settings-custom-json"
              onChange={(event) => updateCustomDraft(event.target.value)}
              spellCheck={false}
              value={customJson}
            />
          </label>

          {customIssues.length > 0 && (
            <div
              aria-live="polite"
              className="home-settings-validation"
              id="home-settings-custom-errors"
              role="alert"
            >
              <p>Theme document needs attention.</p>
              <ul>
                {customIssues.map((issue) => (
                  <li key={`${issue.path}:${issue.message}`}>
                    <strong>{issue.path}</strong>: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {customSuggestions.length > 0 && (
            <div
              aria-live="polite"
              className="home-settings-validation home-settings-suggestions"
              id="home-settings-custom-suggestions"
            >
              <p>Optional readability suggestions.</p>
              <ul>
                {customSuggestions.map((suggestion) => (
                  <li key={`${suggestion.path}:${suggestion.message}`}>
                    <strong>{suggestion.path}</strong>: {suggestion.message}
                  </li>
                ))}
              </ul>
              <p className="home-settings-suggestions-note">
                These do not block applying your theme.
              </p>
            </div>
          )}

          <div className="home-settings-custom-actions">
            <label className="home-settings-action home-settings-upload">
              <Upload aria-hidden="true" size={15} />
              <span>Load JSON</span>
              <input
                ref={fileInputRef}
                accept=".json,application/json"
                className="home-settings-file-input"
                onChange={handleCustomFileChange}
                type="file"
              />
            </label>
            <button className="home-settings-action" onClick={handleDownloadTemplate} type="button">
              <Download aria-hidden="true" size={15} />
              <span>Template</span>
            </button>
          </div>

          <div className="home-settings-custom-actions">
            <button
              className="home-settings-action home-settings-action-primary"
              disabled={!customDraft}
              onClick={handleApplyCustomTheme}
              type="button"
            >
              Apply custom
            </button>
            {customTheme && (
              <>
                <button
                  className="home-settings-action"
                  onClick={handleExportCustomTheme}
                  type="button"
                >
                  <Download aria-hidden="true" size={15} />
                  <span>Export</span>
                </button>
                <button
                  className="home-settings-action"
                  onClick={handleResetCustomTheme}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        </fieldset>

        <output aria-live="polite" className="sr-only">
          {announcement}
        </output>
      </section>

      <button
        ref={triggerRef}
        aria-controls="home-settings-panel"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close interface settings" : "Open interface settings"}
        className="home-settings-trigger"
        data-state={isOpen ? "open" : "closed"}
        onClick={() => (isOpen ? closeSettings() : openPanel("settings"))}
        type="button"
      >
        <Settings2 aria-hidden="true" size={18} />
      </button>
    </div>
  );
}

export default function HomeSettings() {
  const location = useLocation();
  if (location.pathname !== "/") return null;
  return <HomeSettingsPanel />;
}
