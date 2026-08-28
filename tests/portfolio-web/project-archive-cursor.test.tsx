import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProjectArchive from "../../apps/portfolio-web/src/components/pages/projectsPage/ProjectArchive";
import type { MediaItem } from "../../apps/portfolio-web/src/types/MediaCardTypes";

const project: MediaItem = {
  id: 1,
  title: "Simple Student Information System",
  type: "image",
  url: "/preview.png",
  shortDescription: "A project preview.",
  longDescription: "A project description.",
  projectLink: "https://example.com/project",
  gallery: [],
};

test("keeps the archive cursor stable across the interactive project row", () => {
  const markup = renderToStaticMarkup(
    createElement(ProjectArchive, {
      isInteractive: () => true,
      onOpenProject: () => undefined,
      projects: [project],
      startIndex: 0,
    }),
  );

  assert.match(markup, /<article[^>]*class="project-archive-row"[^>]*data-cursor="cell"/);
});
