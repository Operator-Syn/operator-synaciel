import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ProjectArchive from "../src/components/pages/projectsPage/ProjectArchive";
import type { MediaItem } from "../src/types/MediaCardTypes";

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
  // The row title is a link now, so the component needs a router in scope.
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(ProjectArchive, {
        isInteractive: () => true,
        onOpenProject: () => undefined,
        projects: [project],
        startIndex: 0,
      }),
    ),
  );

  assert.match(markup, /<article[^>]*class="project-archive-row"[^>]*data-cursor="cell"/);
});
