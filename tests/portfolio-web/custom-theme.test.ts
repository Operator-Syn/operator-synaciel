import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOM_THEME_COLOR_ROLES,
  CUSTOM_THEME_CSS_VARIABLES,
  CUSTOM_THEME_MAX_BYTES,
  CUSTOM_THEME_SHADOW_CSS_VARIABLES,
  CUSTOM_THEME_SHADOW_ROLES,
  type CustomThemeDocument,
  type CustomThemeParseResult,
  createCustomThemeTemplate,
  DEFAULT_CUSTOM_THEME_SHADOWS,
  parseCustomThemeDocument,
  resolveCustomThemeColors,
  resolveCustomThemeShadows,
  serializeCustomTheme,
} from "../../apps/portfolio-web/src/preferences/customTheme.ts";
import {
  applySitePreferences,
  CUSTOM_THEME_STORAGE_KEY,
  DEFAULT_SITE_THEME,
  persistSitePreferences,
  readSitePreferences,
  type StoredSitePreferences,
} from "../../apps/portfolio-web/src/preferences/sitePreferences.ts";

type StorageLike = NonNullable<Parameters<typeof readSitePreferences>[0]>;
type RootLike = NonNullable<Parameters<typeof applySitePreferences>[1]>;

function createStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial));

  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function validThemeResult(result: CustomThemeParseResult): CustomThemeDocument {
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }

  return result.theme;
}

function createRoot() {
  const styleValues = new Map<string, string>();
  const root = {
    dataset: {} as Record<string, string | undefined>,
    style: {
      removeProperty: (property: string) => styleValues.delete(property),
      setProperty: (property: string, value: string) => styleValues.set(property, value),
    },
  } as unknown as RootLike;

  return { root, styleValues };
}

test("accepts partial themes and normalizes names and color casing", () => {
  const theme = validThemeResult(
    parseCustomThemeDocument(
      JSON.stringify({
        version: 1,
        name: "  Night   Signal  ",
        colors: {
          signal: "#FFBB52",
          line: " #F2EDE32E ",
        },
      }),
    ),
  );

  assert.equal(theme.name, "Night Signal");
  assert.deepEqual(theme.colors, {
    signal: "#ffbb52",
    line: "#f2ede32e",
  });
  assert.equal(resolveCustomThemeColors(theme).surface, "#171918");
  assert.equal(resolveCustomThemeShadows(theme).panel, DEFAULT_CUSTOM_THEME_SHADOWS.panel);
});

test("template exposes every documented role and is itself valid", () => {
  const theme = validThemeResult(parseCustomThemeDocument(createCustomThemeTemplate()));

  assert.equal(Object.keys(theme.colors).length, CUSTOM_THEME_COLOR_ROLES.length);
  assert.deepEqual(Object.keys(theme.colors), [...CUSTOM_THEME_COLOR_ROLES]);
  assert.deepEqual(Object.keys(theme.shadows), [...CUSTOM_THEME_SHADOW_ROLES]);
  assert.deepEqual(theme.shadows, DEFAULT_CUSTOM_THEME_SHADOWS);
});

test("accepts shadow tints while rejecting shadow geometry and unknown roles", () => {
  const theme = validThemeResult(
    parseCustomThemeDocument(
      JSON.stringify({
        version: 1,
        colors: { signal: "#f0a42a" },
        shadows: { panel: " #00000080 ", media: "#123456" },
      }),
    ),
  );

  assert.deepEqual(theme.shadows, {
    panel: "#00000080",
    media: "#123456",
  });
  assert.deepEqual(
    validThemeResult(parseCustomThemeDocument(serializeCustomTheme(theme))).shadows,
    theme.shadows,
  );

  const invalid = parseCustomThemeDocument(
    JSON.stringify({
      version: 1,
      colors: { signal: "#f0a42a" },
      shadows: { panel: "0 0 5px red", unknown: "#000000" },
    }),
  );

  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(invalid.issues.some((issue) => issue.path === "shadows.panel"));
    assert.ok(invalid.issues.some((issue) => issue.path === "shadows.unknown"));
  }
});

test("reports malformed JSON with a useful syntax message", () => {
  for (const input of [
    '{"version":1,"colors":{"signal":"#f0a42a",}}',
    '{"version":1,"colors":{"signal":"#f0a42a"}',
  ]) {
    const result = parseCustomThemeDocument(input);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issues[0]?.path, "$");
      assert.match(result.issues[0]?.message ?? "", /Invalid JSON/);
    }
  }
});

test("rejects unknown keys, unsafe CSS-like values, and non-hex colors", () => {
  const result = parseCustomThemeDocument(
    '{"version":1,"unexpected":true,"colors":{"signal":"var(--danger)","--color-canvas":"#101111","__proto__":{"canvas":"#101111"}}}',
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "unexpected"));
    assert.ok(result.issues.some((issue) => issue.path === "colors.signal"));
    assert.ok(result.issues.some((issue) => issue.path === "colors.--color-canvas"));
    assert.ok(result.issues.some((issue) => issue.path === "colors.__proto__"));
  }
});

test("rejects oversized documents but accepts and advises on low-contrast combinations", () => {
  const oversized = parseCustomThemeDocument(" ".repeat(CUSTOM_THEME_MAX_BYTES + 1));
  assert.equal(oversized.ok, false);
  if (!oversized.ok) {
    assert.match(oversized.issues[0]?.message ?? "", /16 KB/);
  }

  const lowContrast = parseCustomThemeDocument(
    JSON.stringify({
      version: 1,
      colors: {
        signal: "#000000",
      },
    }),
  );
  assert.equal(lowContrast.ok, true);
  if (lowContrast.ok) {
    assert.equal(lowContrast.theme.colors.signal, "#000000");
    assert.ok(lowContrast.suggestions.some((suggestion) => suggestion.path === "colors.signal"));
  }
});

test("persists a custom document and falls back safely when storage is invalid", () => {
  const theme = validThemeResult(
    parseCustomThemeDocument(
      JSON.stringify({
        version: 1,
        name: "Local dusk",
        colors: { canvas: "#202020" },
      }),
    ),
  );
  const storage = createStorage();

  const preferences: StoredSitePreferences = {
    theme: "custom",
    reducedMotion: false,
    customTheme: theme,
  };
  persistSitePreferences(preferences, storage);

  assert.equal(storage.getItem(CUSTOM_THEME_STORAGE_KEY) !== null, true);
  assert.deepEqual(readSitePreferences(storage), preferences);

  storage.setItem(CUSTOM_THEME_STORAGE_KEY, '{"version":1,"colors":{"signal":"red"}}');
  storage.setItem("operator-syn:theme", "custom");
  const fallback = readSitePreferences(storage);

  assert.equal(fallback.theme, DEFAULT_SITE_THEME);
  assert.equal(fallback.customTheme, null);
  assert.equal(storage.getItem(CUSTOM_THEME_STORAGE_KEY), null);
});

test("applies resolved custom variables and clears them for built-in themes", () => {
  const theme = validThemeResult(
    parseCustomThemeDocument(
      JSON.stringify({
        version: 1,
        colors: { canvas: "#202020" },
        shadows: { panel: "#00000080" },
      }),
    ),
  );
  const { root, styleValues } = createRoot();

  applySitePreferences(
    {
      theme: "custom",
      reducedMotion: false,
      customTheme: theme,
    },
    root,
  );

  assert.equal(root.dataset.theme, "custom");
  assert.equal(styleValues.get(CUSTOM_THEME_CSS_VARIABLES.canvas), "#202020");
  assert.equal(styleValues.get(CUSTOM_THEME_CSS_VARIABLES.surface), "#171918");
  assert.equal(
    styleValues.get(CUSTOM_THEME_SHADOW_CSS_VARIABLES.panel),
    "0 1.25rem 3rem #00000080",
  );
  assert.equal(
    styleValues.get(CUSTOM_THEME_SHADOW_CSS_VARIABLES.media),
    "0 0.5rem 1.5rem #0000004d",
  );
  assert.equal(
    styleValues.get(CUSTOM_THEME_SHADOW_CSS_VARIABLES.viewerTools),
    "0 0.5rem 1.5rem #0000003d",
  );

  applySitePreferences(
    {
      theme: "dalan",
      reducedMotion: false,
      customTheme: theme,
    },
    root,
  );

  assert.equal(root.dataset.theme, "dalan");
  for (const role of CUSTOM_THEME_COLOR_ROLES) {
    assert.equal(styleValues.has(CUSTOM_THEME_CSS_VARIABLES[role]), false);
  }
  for (const role of CUSTOM_THEME_SHADOW_ROLES) {
    assert.equal(styleValues.has(CUSTOM_THEME_SHADOW_CSS_VARIABLES[role]), false);
  }
});

test("exposes the fixed custom theme editor contract", async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const repositoryRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");
  const [settings, styles] = await Promise.all([
    readFile(resolve(repositoryRoot, "src/components/homePage/HomeSettings.tsx"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/home-settings.css"), "utf8"),
  ]);

  assert.match(settings, /type="file"/);
  assert.match(settings, /home-settings-custom-json/);
  assert.match(settings, /customSuggestions/);
  assert.match(settings, /home-settings-custom-suggestions/);
  assert.match(settings, /Apply custom/);
  assert.match(settings, /handleResetCustomTheme/);
  assert.match(styles, /max-height:[\s\S]*100dvh/);
  assert.match(styles, /overflow-y: auto/);
  assert.doesNotMatch(styles, /!important/);
});
