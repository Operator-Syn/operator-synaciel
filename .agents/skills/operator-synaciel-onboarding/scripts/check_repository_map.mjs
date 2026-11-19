/** Read-only existence and onboarding coverage checks for the Operator-Synaciel map. */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = ".agents/skills/operator-synaciel-onboarding";
const adjacentRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const playbooks = ["web-and-api.md", "assistant-and-mcp.md", "delivery-and-recovery.md"];
const requiredDocs = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/README.md",
  "docs/PRODUCT.md",
  "docs/DESIGN.md",
  "docs/obsidian.md",
  "docs/design-system/README.md",
  "docs/architecture/overview.md",
  "docs/architecture/repository-layout.md",
  "docs/operations/local-development.md",
  "docs/operations/deployment.md",
];

/** Match instruction files and top-level contract guides, not plans or archived sweeps. */
function isCoverageDocument(path) {
  return (
    requiredDocs.includes(path) ||
    /^(?:AGENTS(?:\.override)?|CLAUDE)\.md$/.test(basename(path)) ||
    /^docs\/(?:architecture|api|database|operations)\/[^/]+\.md$/.test(path)
  );
}

/** Accept only literal, slash-separated checkout paths; reject traversals before reading metadata. */
function isRepositoryPath(path) {
  return path.split("/").every((part) => /^[\w.@-]+$/.test(part) && part !== "." && part !== "..");
}

/** Run Git in the selected checkout and return its output without changing the index. */
function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

/** Collect literal table paths, reporting invalid paths with the guide and line that own them. */
function readIndex(markdown, name, problems) {
  const index = new Set();
  for (const [offset, line] of markdown.split("\n").entries()) {
    if (!line.startsWith("|")) continue;
    for (const [, span] of line.matchAll(/`([^`]+)`/g)) {
      if (!isRepositoryPath(span.replace(/\/$/, ""))) {
        problems.push(`Invalid repository path in ${name}:${offset + 1}: ${span}`);
      } else {
        index.add(span);
      }
    }
  }
  return index;
}

/** Check ordinary relative Markdown file links outside examples; return their resolved targets. */
function checkMarkdownLinks(root, file, markdown, problems) {
  const targets = new Set();
  let fence;
  for (const [offset, line] of markdown.split("\n").entries()) {
    // 1. Skip fenced examples; they are not navigation the onboarding agent follows.
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1].startsWith(fence) && !marker[2].trim()) fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }

    // 2. Resolve file destinations relative to the linking document, never fetch external URLs.
    for (const [, link] of line.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      const target = link.split("#", 1)[0];
      if (!target.endsWith(".md") || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
      const destination = resolve(dirname(file), target);
      const fromRoot = relative(root, destination);
      if (
        fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot) ||
        !statSync(destination, { throwIfNoEntry: false })?.isFile()
      ) {
        const source = relative(join(root, skillDir), file);
        problems.push(`Broken onboarding link in ${source}:${offset + 1}: ${link}`);
      } else targets.add(destination);
    }
  }
  return targets;
}

/** Collect the skill's connected reference set and its indexed repository paths. */
function readReferencePaths(root, problems) {
  // 1. Require a working doorway from the skill to the map and from the map to each playbook.
  const directory = join(root, skillDir, "references");
  const skillPath = join(root, skillDir, "SKILL.md");
  const mapPath = join(directory, "repository-map.md");
  const skill = readFileSync(skillPath, "utf8");
  if (!checkMarkdownLinks(root, skillPath, skill, problems).has(mapPath)) {
    problems.push("SKILL.md does not link to repository-map.md");
  }
  const map = readFileSync(mapPath, "utf8");
  const mapLinks = checkMarkdownLinks(root, mapPath, map, problems);
  const index = readIndex(map, "repository-map.md", problems);

  // 2. Verify each guide's own links and index its task paths for the repository checks.
  for (const name of playbooks) {
    const path = join(directory, name);
    if (!mapLinks.has(path)) problems.push(`Repository map does not link to playbook: ${name}`);
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      problems.push(`Playbook does not exist: ${name}`);
      continue;
    }
    const guide = readFileSync(path, "utf8");
    checkMarkdownLinks(root, path, guide, problems);
    const entries = readIndex(guide, name, problems);
    if (entries.size === 0) problems.push(`Playbook has no indexed task paths: ${name}`);
    for (const entry of entries) index.add(entry);
  }
  return index;
}

/** Verify the selected repo, then compare the map against its live paths and Git coverage baseline. */
function check(args) {
  // Establish scope independently of cwd, and reject an explicit subdirectory or different project.
  if (args.length !== 0 && !(args.length === 2 && args[0] === "--root" && args[1])) {
    throw new Error("Usage: node check_repository_map.mjs [--root <repository-root>]");
  }
  const root = realpathSync(resolve(args[1] ?? adjacentRoot));
  if (realpathSync(git(root, "rev-parse", "--show-toplevel").trim()) !== root) {
    throw new Error(`Expected the Git root, not a subdirectory: ${root}`);
  }
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const { workspaces } = manifest;
  if (
    manifest.name !== "operator-synaciel" ||
    !Array.isArray(workspaces) ||
    !workspaces.includes("apps/portfolio-web") ||
    !workspaces.includes("workers/portfolio-api") ||
    !workspaces.every((path) => typeof path === "string" && isRepositoryPath(path))
  ) {
    throw new Error(`Expected the Operator-Synaciel workspace manifest at ${root}`);
  }

  // Catch stale paths regardless of whether the map or target is already tracked.
  const problems = [];
  const index = readReferencePaths(root, problems);
  for (const path of index) {
    const stat = statSync(join(root, path.replace(/\/$/, "")), { throwIfNoEntry: false });
    if (!stat) problems.push(`Indexed path does not exist: ${path}`);
    else if (path.endsWith("/") ? !stat.isDirectory() : !stat.isFile()) {
      problems.push(`Indexed path has the wrong file type: ${path}`);
    }
  }

  // Require tracked live guides and instructions, plus fixed anchors and every current workspace.
  // A deleted tracked guide is reported separately so a known retirement need not stay indexed.
  const tracked = new Set(git(root, "ls-files", "--cached", "-z").split("\0").filter(isCoverageDocument));
  const deleted = git(root, "ls-files", "--deleted", "-z").split("\0").filter((path) => tracked.has(path));
  const required = new Set(["package.json", ...requiredDocs]);
  for (const path of deleted) tracked.delete(path);
  for (const path of tracked) required.add(path);
  for (const workspace of workspaces) {
    required.add(`${workspace}/package.json`);
    required.add(`${workspace}/src/`);
    required.add(`${workspace}/tests/`);
  }
  for (const path of required) {
    if (!index.has(path)) problems.push(`Required onboarding path is not indexed: ${path}`);
  }

  // Untracked instructions and guides are review hints, not coverage drift in the Git baseline.
  for (const path of deleted) console.log(`Review tracked guide removed from the worktree: ${path}`);
  for (const path of git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0")) {
    if (isCoverageDocument(path)) {
      console.log(`Review untracked onboarding path (${index.has(path) ? "indexed" : "not indexed"}): ${path}`);
    }
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    return 1;
  }
  console.log(`Repository map checked: ${index.size} indexed paths, ${required.size} required paths.`);
  return 0;
}

try {
  process.exitCode = check(process.argv.slice(2));
} catch (error) {
  console.error(`Repository map check failed: ${error.message}`);
  process.exitCode = 1;
}
