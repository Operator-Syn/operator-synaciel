import assert from "node:assert/strict";
import { test } from "node:test";
import { createThemeAwareSyntaxTheme } from "../../apps/portfolio-web/src/components/pages/snippetsPage/syntaxTheme.ts";

test("maps syntax highlighting colors to semantic theme variables", () => {
  const theme = createThemeAwareSyntaxTheme();
  const serializedTheme = JSON.stringify(theme);

  assert.equal(theme.comment?.color, "var(--color-text-faint)");
  assert.equal(theme.keyword?.color, "var(--color-signal)");
  assert.equal(theme['pre[class*="language-"]']?.background, "var(--color-canvas)");
  assert.match(String(theme[".line-highlight.line-highlight"]?.boxShadow), /var\(--color-signal\)/);
  assert.doesNotMatch(serializedTheme, /#[0-9a-f]{6}/i);
});
