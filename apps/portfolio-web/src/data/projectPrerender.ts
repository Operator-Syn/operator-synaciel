/**
 * The crawler-visible body of a project detail page.
 *
 * The app renders into an empty `#root`, so a client that does not execute JavaScript sees only the
 * head. `/projects/<id>/<slug>` therefore needs real markup in the shell, and this module writes it at
 * build time from the archive response: the same title, summary, facets and description the page
 * renders, plus the site navigation every fragment carries.
 *
 * Nothing here fetches, and nothing here needs an asset: no `<script>`, no `<style>`, no `<img>`. The
 * fragment has to render under the page's CSP and on a build with no network beyond the archive read.
 */

import type { ProjectDescriptionBlock } from "../components/pages/projectsPage/projectDescription.ts";
import { escapeHtml, renderPrerenderNav } from "./prerenderRoutes.ts";
import type { ApiProject } from "./projectArchive.ts";
import { safeExternalHref } from "./projectRoutes.ts";

/** Render one description block. */
function renderBlock(block: ProjectDescriptionBlock): string {
  if (block.kind === "paragraph") return `<p>${escapeHtml(block.text)}</p>`;
  return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

/**
 * Render a project's fragment.
 *
 * Algorithm:
 * 1. Open a `<main>` with the same class and id the static fragments use, so the stylesheet and the
 *    runtime check that looks for `.prerender-body` treat both alike.
 * 2. Emit the `h1` (the project title), then the summary as the lead paragraph.
 * 3. Emit the outbound project link when it parses as http(s).
 * 4. Emit `Stack` and `Highlights` lists when the project has them.
 * 5. Emit the description blocks, then the shared navigation.
 * 6. Close the `<main>`.
 *
 * @param project The project record from the archive.
 * @param blocks The parsed description blocks, in document order.
 * @returns The HTML fragment, ready to be injected into `#root`.
 */
export function buildProjectFragment(
  project: ApiProject,
  blocks: readonly ProjectDescriptionBlock[],
): string {
  const title = escapeHtml(project.title);
  const summary = project.short_description
    ? `<p class="prerender-lead">${escapeHtml(project.short_description)}</p>`
    : "";

  const href = safeExternalHref(project.project_link);
  const link = href
    ? `<p class="prerender-project-link"><a href="${escapeHtml(href)}" rel="noopener noreferrer">Visit project</a></p>`
    : "";

  const stack = project.stack.length
    ? `<h2>Stack</h2><ul>${project.stack.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

  const highlights = project.highlights.length
    ? `<h2>Highlights</h2><ul>${project.highlights
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";

  const description = blocks.map(renderBlock).join("");

  return [
    '<main class="prerender-body prerender-project" id="prerender-body">',
    `<h1>${title}</h1>`,
    summary,
    link,
    stack,
    highlights,
    description,
    renderPrerenderNav(),
    "</main>",
  ].join("");
}
