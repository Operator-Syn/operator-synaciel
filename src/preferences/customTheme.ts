export const CUSTOM_THEME_STORAGE_KEY = "operator-syn:custom-theme";
export const CUSTOM_THEME_VERSION = 1 as const;
export const CUSTOM_THEME_MAX_BYTES = 16 * 1024;
export const CUSTOM_THEME_NAME_MAX_LENGTH = 48;

export const CUSTOM_THEME_COLOR_ROLES = [
  "canvas",
  "surface",
  "surfaceRaised",
  "text",
  "textMuted",
  "textFaint",
  "line",
  "lineStrong",
  "signal",
  "signalStrong",
  "danger",
  "success",
  "canvasOverlay",
  "canvasOverlaySoft",
  "canvasOverlayStrong",
  "canvasOverlayNavigation",
  "signalSoft",
] as const;

export type CustomThemeColorRole = (typeof CUSTOM_THEME_COLOR_ROLES)[number];
export type HexColor = `#${string}`;
export type CustomThemeColors = Partial<Record<CustomThemeColorRole, HexColor>>;

export interface CustomThemeDocument {
  version: typeof CUSTOM_THEME_VERSION;
  name: string;
  colors: CustomThemeColors;
}

export interface CustomThemeParseIssue {
  path: string;
  message: string;
}

export interface CustomThemeSuggestion {
  path: string;
  message: string;
}

export type CustomThemeParseResult =
  | { ok: true; theme: CustomThemeDocument; suggestions: CustomThemeSuggestion[] }
  | { ok: false; issues: CustomThemeParseIssue[] };

export const CUSTOM_THEME_CSS_VARIABLES: Record<CustomThemeColorRole, string> = {
  canvas: "--color-canvas",
  surface: "--color-surface",
  surfaceRaised: "--color-surface-raised",
  text: "--color-text",
  textMuted: "--color-text-muted",
  textFaint: "--color-text-faint",
  line: "--color-line",
  lineStrong: "--color-line-strong",
  signal: "--color-signal",
  signalStrong: "--color-signal-strong",
  danger: "--color-danger",
  success: "--color-success",
  canvasOverlay: "--color-canvas-overlay",
  canvasOverlaySoft: "--color-canvas-overlay-soft",
  canvasOverlayStrong: "--color-canvas-overlay-strong",
  canvasOverlayNavigation: "--color-canvas-overlay-navigation",
  signalSoft: "--color-signal-soft",
};

export const DEFAULT_CUSTOM_THEME_COLORS: Record<CustomThemeColorRole, HexColor> = {
  canvas: "#101111",
  surface: "#171918",
  surfaceRaised: "#202321",
  text: "#f2ede3",
  textMuted: "#b7b1a7",
  textFaint: "#7e7b74",
  line: "#f2ede32e",
  lineStrong: "#f2ede359",
  signal: "#f0a42a",
  signalStrong: "#ffbb52",
  danger: "#d96a5c",
  success: "#98bd79",
  canvasOverlay: "#101111eb",
  canvasOverlaySoft: "#101111d6",
  canvasOverlayStrong: "#101111f5",
  canvasOverlayNavigation: "#101111db",
  signalSoft: "#f0a42a1f",
};

const COLOR_ROLE_SET = new Set<string>(CUSTOM_THEME_COLOR_ROLES);
const OPAQUE_COLOR_ROLE_SET = new Set<CustomThemeColorRole>([
  "canvas",
  "surface",
  "surfaceRaised",
  "text",
  "textMuted",
  "textFaint",
  "signal",
  "signalStrong",
  "danger",
  "success",
]);
const TOP_LEVEL_KEYS = new Set(["version", "name", "colors"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
function fail(...issues: CustomThemeParseIssue[]): CustomThemeParseResult {
  return { ok: false, issues };
}

function syntaxIssue(input: string, error: unknown): CustomThemeParseIssue {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/position\s+(\d+)/i);

  if (!match) {
    return {
      path: "$",
      message: "Invalid JSON. Check commas, quotes, and closing brackets.",
    };
  }

  const offset = Math.min(Number(match[1]), input.length);
  const beforeOffset = input.slice(0, offset);
  const line = beforeOffset.split("\n").length;
  const lastLineBreak = beforeOffset.lastIndexOf("\n");
  const column = offset - lastLineBreak;

  return {
    path: "$",
    message:
      "Invalid JSON near line " +
      line +
      ", column " +
      column +
      ". Check commas, quotes, and closing brackets.",
  };
}

export function resolveCustomThemeColors(
  theme: CustomThemeDocument,
): Record<CustomThemeColorRole, HexColor> {
  const resolved = {} as Record<CustomThemeColorRole, HexColor>;

  for (const role of CUSTOM_THEME_COLOR_ROLES) {
    resolved[role] = theme.colors[role] ?? DEFAULT_CUSTOM_THEME_COLORS[role];
  }

  return resolved;
}

const CONTRAST_BACKGROUNDS = ["canvas", "surface", "surfaceRaised"] as const;
const CONTRAST_RULES = [
  { role: "text", label: "primary text", threshold: 4.5 },
  { role: "textMuted", label: "supporting text", threshold: 4.5 },
  { role: "textFaint", label: "metadata text", threshold: 3 },
  { role: "signal", label: "signal text", threshold: 4.5 },
  { role: "signalStrong", label: "strong signal text", threshold: 4.5 },
  { role: "danger", label: "error text", threshold: 4.5 },
  { role: "success", label: "success text", threshold: 4.5 },
] as const satisfies ReadonlyArray<{
  role: CustomThemeColorRole;
  label: string;
  threshold: number;
}>;

function relativeLuminance(color: HexColor) {
  const channels = color
    .slice(1, 7)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) return 0;

  return channels.reduce(
    (total, channel, index) =>
      total +
      (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][index],
    0,
  );
}

function contrastRatio(foreground: HexColor, background: HexColor) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function formatContrastRatio(ratio: number) {
  return `${ratio.toFixed(2)}:1`;
}

export function getCustomThemeSuggestions(theme: CustomThemeDocument): CustomThemeSuggestion[] {
  const resolved = resolveCustomThemeColors(theme);
  const suggestions: CustomThemeSuggestion[] = [];

  for (const rule of CONTRAST_RULES) {
    const failures = CONTRAST_BACKGROUNDS.flatMap((background) => {
      const ratio = contrastRatio(resolved[rule.role], resolved[background]);
      return ratio < rule.threshold ? [`${background} (${formatContrastRatio(ratio)})`] : [];
    });

    if (failures.length === 0) continue;

    const actionNote =
      (rule.role === "signal" || rule.role === "signalStrong") &&
      failures.some((failure) => failure.startsWith("canvas "))
        ? " Filled actions using canvas text will share this contrast."
        : "";

    suggestions.push({
      path: `colors.${rule.role}`,
      message: `Readability suggestion: ${rule.label} is below the suggested ${rule.threshold}:1 ratio on ${failures.join(", ")}.${actionNote}`,
    });
  }

  return suggestions;
}

function normalizeCustomTheme(value: unknown): CustomThemeParseResult {
  if (!isPlainRecord(value)) {
    return fail({ path: "$", message: "Theme must be a JSON object." });
  }

  const issues: CustomThemeParseIssue[] = [];

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key) || UNSAFE_KEYS.has(key)) {
      issues.push({ path: key, message: "Unknown property." });
    }
  }

  if (value.version !== CUSTOM_THEME_VERSION) {
    issues.push({ path: "version", message: "Only version 1 is supported." });
  }

  let name = "Custom theme";
  if (Object.hasOwn(value, "name")) {
    if (typeof value.name !== "string") {
      issues.push({ path: "name", message: "Must be a string." });
    } else if (hasControlCharacters(value.name)) {
      issues.push({ path: "name", message: "Cannot contain control characters." });
    } else {
      name = value.name.trim().replace(/\s+/g, " ");

      if (!name) {
        issues.push({ path: "name", message: "Cannot be empty." });
      } else if (Array.from(name).length > CUSTOM_THEME_NAME_MAX_LENGTH) {
        issues.push({
          path: "name",
          message: "Must be 48 characters or fewer.",
        });
      }
    }
  }

  const rawColors = value.colors;
  if (!isPlainRecord(rawColors)) {
    issues.push({ path: "colors", message: "Must be a non-empty object." });
  } else {
    const normalizedColors: CustomThemeColors = {};

    for (const key of Object.keys(rawColors)) {
      if (!COLOR_ROLE_SET.has(key) || UNSAFE_KEYS.has(key)) {
        issues.push({ path: `colors.${key}`, message: "Unknown color role." });
        continue;
      }

      const role = key as CustomThemeColorRole;
      const rawValue = rawColors[key];

      if (typeof rawValue !== "string") {
        issues.push({ path: `colors.${role}`, message: "Must be a hexadecimal color." });
        continue;
      }

      const color = rawValue.trim();
      const acceptsAlpha = !OPAQUE_COLOR_ROLE_SET.has(role);

      if (!HEX_COLOR_PATTERN.test(color)) {
        issues.push({
          path: `colors.${role}`,
          message: acceptsAlpha ? "Use #RRGGBB or #RRGGBBAA." : "Use an opaque #RRGGBB value.",
        });
        continue;
      }

      if (!acceptsAlpha && color.length !== 7) {
        issues.push({
          path: `colors.${role}`,
          message: "Use an opaque #RRGGBB value.",
        });
        continue;
      }

      normalizedColors[role] = color.toLowerCase() as HexColor;
    }

    if (Object.keys(normalizedColors).length === 0) {
      issues.push({ path: "colors", message: "Add at least one supported color role." });
    }

    if (issues.length === 0) {
      const theme: CustomThemeDocument = {
        version: CUSTOM_THEME_VERSION,
        name,
        colors: normalizedColors,
      };
      return { ok: true, theme, suggestions: getCustomThemeSuggestions(theme) };
    }
  }

  return fail(...issues);
}

export function parseCustomThemeDocument(input: string): CustomThemeParseResult {
  const byteLength = new TextEncoder().encode(input).byteLength;

  if (byteLength > CUSTOM_THEME_MAX_BYTES) {
    return fail({
      path: "$",
      message: "Theme file must be 16 KB or smaller.",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    return fail(syntaxIssue(input, error));
  }

  return normalizeCustomTheme(parsed);
}

export function serializeCustomTheme(theme: CustomThemeDocument) {
  const colors: CustomThemeColors = {};

  for (const role of CUSTOM_THEME_COLOR_ROLES) {
    const value = theme.colors[role];
    if (value) colors[role] = value;
  }

  return `${JSON.stringify(
    {
      version: CUSTOM_THEME_VERSION,
      name: theme.name,
      colors,
    },
    null,
    2,
  )}\n`;
}

export function createCustomThemeTemplate() {
  return serializeCustomTheme({
    version: CUSTOM_THEME_VERSION,
    name: "My theme",
    colors: DEFAULT_CUSTOM_THEME_COLORS,
  });
}

export function applyCustomThemeColors(root: HTMLElement, theme: CustomThemeDocument) {
  const resolved = resolveCustomThemeColors(theme);

  for (const role of CUSTOM_THEME_COLOR_ROLES) {
    root.style.setProperty(CUSTOM_THEME_CSS_VARIABLES[role], resolved[role]);
  }
}

export function clearCustomThemeColors(root: HTMLElement) {
  for (const role of CUSTOM_THEME_COLOR_ROLES) {
    root.style.removeProperty(CUSTOM_THEME_CSS_VARIABLES[role]);
  }
}
