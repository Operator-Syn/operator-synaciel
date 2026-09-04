import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

test("mounts visitor controls in one safe-area-aware dock", async () => {
  const [
    app,
    dock,
    context,
    provider,
    tokens,
    home,
    quick,
    settings,
    assistant,
    dockStyles,
    homeStyles,
    quickStyles,
    assistantStyles,
  ] = await Promise.all([
    readFile(resolve(repositoryRoot, "src/App.tsx"), "utf8"),
    readFile(
      resolve(repositoryRoot, "src/components/floatingControls/FloatingControlsDock.tsx"),
      "utf8",
    ),
    readFile(
      resolve(repositoryRoot, "src/components/floatingControls/FloatingControlsContext.tsx"),
      "utf8",
    ),
    readFile(
      resolve(repositoryRoot, "src/components/floatingControls/FloatingControlsProvider.tsx"),
      "utf8",
    ),
    readFile(resolve(repositoryRoot, "src/styles/tokens.css"), "utf8"),
    readFile(resolve(repositoryRoot, "src/components/pages/homePage/Home.tsx"), "utf8"),
    readFile(resolve(repositoryRoot, "src/components/quickNavigation/QuickNavigation.tsx"), "utf8"),
    readFile(resolve(repositoryRoot, "src/components/homePage/HomeSettings.tsx"), "utf8"),
    readFile(
      resolve(repositoryRoot, "src/components/portfolioAssistant/PortfolioAssistantFab.tsx"),
      "utf8",
    ),
    readFile(resolve(repositoryRoot, "src/styles/floating-controls.css"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/home-settings.css"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/quick-navigation.css"), "utf8"),
    readFile(
      resolve(repositoryRoot, "src/components/portfolioAssistant/PortfolioAssistant.css"),
      "utf8",
    ),
  ]);

  assert.match(app, /FloatingControlsProvider/);
  assert.match(app, /<FloatingControlsDock>/);
  assert.match(
    app,
    /<PortfolioAssistantFab \/>[\s\S]*<HomeSettings \/>[\s\S]*<QuickNavigation \/>/,
  );
  assert.doesNotMatch(home, /<HomeSettings \/>/);
  assert.match(quick, /data-floating-panel="quick-navigation"/);
  assert.match(settings, /data-floating-panel="settings"/);
  assert.match(assistant, /data-floating-panel="assistant"/);
  assert.match(dock, /data-active-panel=\{activePanel \?\? "none"\}/);
  assert.match(context, /activePanel: FloatingPanel \| null/);
  assert.match(context, /FloatingPanel =/);
  assert.match(provider, /setActivePanel\(panel\)/);
  assert.match(tokens, /--floating-control-gap:\s*clamp\(1rem,\s*2vw,\s*2rem\);/);
  assert.match(dockStyles, /position:\s*fixed/);
  assert.match(dockStyles, /inset-inline-end:\s*var\(--floating-control-inline-end\)/);
  assert.match(dockStyles, /inset-block-end:\s*var\(--floating-control-block-end\)/);
  assert.match(dockStyles, /gap:\s*var\(--floating-control-gap\)/);
  assert.match(dockStyles, /data-active-panel="assistant"/);
  assert.match(dockStyles, /display:\s*none/);

  assert.match(
    assistantStyles,
    /\.portfolio-assistant\[data-assistant-mode="expanded"\][\s\S]*?position:\s*fixed;/,
  );

  for (const styles of [homeStyles, quickStyles, assistantStyles]) {
    assert.doesNotMatch(
      styles,
      /(?:^|\n)\.portfolio-assistant(?:-panel)?\s*\{\s*position:\s*fixed;/,
    );
    assert.doesNotMatch(styles, /inset-inline-end:\s*var\(--floating-control-inline-end\)/);
    assert.doesNotMatch(styles, /inset-block-end:\s*var\(--floating-control-block-end\)/);
  }
});

test("coordinates exclusive panels, focus restoration, and native titles", async () => {
  const [app, dockStyles, provider, quick, settings, assistant] = await Promise.all([
    readFile(resolve(repositoryRoot, "src/App.tsx"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/floating-controls.css"), "utf8"),
    readFile(
      resolve(repositoryRoot, "src/components/floatingControls/FloatingControlsProvider.tsx"),
      "utf8",
    ),
    readFile(resolve(repositoryRoot, "src/components/quickNavigation/QuickNavigation.tsx"), "utf8"),
    readFile(resolve(repositoryRoot, "src/components/homePage/HomeSettings.tsx"), "utf8"),
    readFile(
      resolve(repositoryRoot, "src/components/portfolioAssistant/PortfolioAssistantFab.tsx"),
      "utf8",
    ),
  ]);

  assert.match(app, /<FloatingControlsProvider>[\s\S]*<FloatingControlsDock>/);
  assert.match(
    provider,
    /setActivePanel\(\(current\) => \(current === panel \? null : current\)\)/,
  );
  assert.match(dockStyles, /data-active-panel="assistant"[\s\S]*display:\s*none/);
  assert.match(quick, /activePanel === "quick-navigation"/);
  assert.match(quick, /toggleRef\.current\?\.focus\(\)/);
  assert.match(quick, /title="Quick navigation"/);
  assert.match(settings, /activePanel === "settings"/);
  assert.match(settings, /triggerRef\.current\?\.focus\(\)/);
  assert.ok(settings.includes('location.pathname !== "/"'));
  assert.match(assistant, /activePanel === "assistant"/);
  assert.match(assistant, /fabRef\.current\?\.focus\(\)/);
  assert.match(assistant, /event\.key !== "Escape"/);
  assert.match(assistant, /document\.addEventListener\("keydown"/);
  assert.match(assistant, /title=\{[\s\S]*Portfolio assistant/);
});
