import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  applySitePreferences,
  DEFAULT_SITE_THEME,
  isSiteTheme,
  persistSitePreferences,
  REDUCED_MOTION_STORAGE_KEY,
  readSitePreferences,
  SITE_THEME_STORAGE_KEY,
} from "../src/preferences/sitePreferences.ts";

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

test("defaults to Dalan with motion preference off", () => {
  assert.equal(DEFAULT_SITE_THEME, "dalan");
  assert.equal(isSiteTheme("dalan"), true);
  assert.equal(isSiteTheme("of-times-old"), true);
  assert.equal(isSiteTheme("vesper-index"), true);
  assert.equal(isSiteTheme("unknown"), false);
  assert.deepEqual(readSitePreferences(null), {
    theme: "dalan",
    reducedMotion: false,
    customTheme: null,
  });
});

test("reads and persists browser-local visitor preferences", () => {
  const storage = createStorage({
    [SITE_THEME_STORAGE_KEY]: "of-times-old",
    [REDUCED_MOTION_STORAGE_KEY]: "on",
  });

  assert.deepEqual(readSitePreferences(storage), {
    theme: "of-times-old",
    reducedMotion: true,
    customTheme: null,
  });

  persistSitePreferences(
    { theme: "vesper-index", reducedMotion: false, customTheme: null },
    storage,
  );

  assert.deepEqual(readSitePreferences(storage), {
    theme: "vesper-index",
    reducedMotion: false,
    customTheme: null,
  });
});

test("applies theme and explicit motion state to the document root", () => {
  const root = {
    dataset: { reducedMotion: "on" },
    style: {
      removeProperty: () => {},
      setProperty: () => {},
    },
  } as unknown as RootLike;

  applySitePreferences({ theme: "of-times-old", reducedMotion: false, customTheme: null }, root);

  assert.equal(root.dataset.theme, "of-times-old");
  assert.equal(root.dataset.reducedMotion, undefined);

  applySitePreferences({ theme: "vesper-index", reducedMotion: false, customTheme: null }, root);
  assert.equal(root.dataset.theme, "vesper-index");
  assert.equal(root.dataset.reducedMotion, undefined);

  applySitePreferences({ theme: "dalan", reducedMotion: true, customTheme: null }, root);

  assert.equal(root.dataset.theme, "dalan");
  assert.equal(root.dataset.reducedMotion, "on");
});

test("keeps the Home settings utility fixed and out of document flow", async () => {
  const repositoryRoot = resolve(import.meta.dirname, "..");
  const [home, styles] = await Promise.all([
    readFile(resolve(repositoryRoot, "src/components/pages/homePage/Home.tsx"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/home-settings.css"), "utf8"),
  ]);

  assert.match(home, /<HomeSettings \/>/);
  assert.match(styles, /\.home-settings\s*\{[\s\S]*position: fixed/);
  assert.match(styles, /\.home-settings\s*\{[\s\S]*pointer-events: none/);
  assert.match(styles, /\.home-settings-panel\[data-state="open"\]/);
  assert.match(styles, /data-reduced-motion="on"/);
});

test("exposes Vesper Index in Home Settings", async () => {
  const settings = await readFile(
    resolve(import.meta.dirname, "../src/components/homePage/HomeSettings.tsx"),
    "utf8",
  );

  assert.match(settings, /label: "Vesper Index", value: "vesper-index"/);
});

test("keeps optional themes color-only", async () => {
  const styles = await readFile(resolve(import.meta.dirname, "../src/styles/tokens.css"), "utf8");
  const oldThemeBlock = styles.match(/:root\[data-theme="of-times-old"\]\s*\{[\s\S]*?\n\}/);
  const vesperThemeBlock = styles.match(/:root\[data-theme="vesper-index"\]\s*\{[\s\S]*?\n\}/);

  assert.ok(oldThemeBlock);
  assert.ok(vesperThemeBlock);
  assert.match(oldThemeBlock[0], /--color-canvas: #173248;/);
  assert.match(oldThemeBlock[0], /--color-surface: #244a60;/);
  assert.match(oldThemeBlock[0], /--color-surface-raised: #2f6276;/);
  assert.match(oldThemeBlock[0], /--color-signal: #b8e3e6;/);
  assert.match(oldThemeBlock[0], /--color-signal-strong: #dbf4f3;/);
  assert.doesNotMatch(oldThemeBlock[0], /#081c30|#173b5d|#1c5789|#9fdaef/);
  assert.match(vesperThemeBlock[0], /--color-canvas: #292831;/);
  assert.match(vesperThemeBlock[0], /--color-surface: #333f58;/);
  assert.match(vesperThemeBlock[0], /--color-surface-raised: #3a5068;/);
  assert.match(vesperThemeBlock[0], /--color-signal: #f7b0b5;/);
  assert.match(vesperThemeBlock[0], /--color-signal-strong: #ffd7ce;/);
  assert.doesNotMatch(vesperThemeBlock[0], /--color-canvas: #101111|--color-signal: #f0a42a/);
  assert.doesNotMatch(styles, /theme-background-image/);
  assert.doesNotMatch(styles, /(?:of-times-old|vesper-index)[\s\S]*--shadow-/);
});
