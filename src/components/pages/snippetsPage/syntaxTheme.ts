import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const SYNTAX_COLOR_VARIABLES: Record<string, string> = {
  "#1e1e1e": "--color-canvas",
  "#264f78": "--color-surface-raised",
  "#4ec9b0": "--color-success",
  "#569cd6": "--color-signal",
  "#6a9955": "--color-text-faint",
  "#808080": "--color-text-faint",
  "#9cdcfe": "--color-text-muted",
  "#b5cea8": "--color-success",
  "#c586c0": "--color-signal-strong",
  "#ce9178": "--color-signal-strong",
  "#d16969": "--color-danger",
  "#d4d4d4": "--color-text",
  "#d7ba7d": "--color-signal-strong",
  "#dcdcaa": "--color-signal-strong",
  "#db4c69": "--color-danger",
  "#f7d87c": "--color-signal",
  "#f7ebc6": "--color-signal-soft",
};

function replaceSyntaxColors(value: unknown) {
  if (typeof value !== "string") return value;

  return value.replace(/#[0-9a-f]{6}/gi, (color) => {
    const variable = SYNTAX_COLOR_VARIABLES[color.toLowerCase()];
    return variable ? `var(${variable})` : color;
  });
}

export function createThemeAwareSyntaxTheme(source: typeof vscDarkPlus = vscDarkPlus) {
  return Object.fromEntries(
    Object.entries(source).map(([selector, styles]) => [
      selector,
      Object.fromEntries(
        Object.entries(styles).map(([property, value]) => [property, replaceSyntaxColors(value)]),
      ),
    ]),
  ) as typeof vscDarkPlus;
}

export const themeAwareSyntaxTheme = createThemeAwareSyntaxTheme();
