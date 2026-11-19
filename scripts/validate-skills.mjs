#!/usr/bin/env node
/**
 * Validate repository skills discovered on disk.
 *
 * No manifest is consulted: each skills root is scanned for immediate child
 * directories that contain a `SKILL.md`. This replaces the previous
 * Python/Pipenv entrypoint and the `skills-lock.json` bundle check.
 *
 * Two check profiles exist:
 *
 * - `repo` (default scan): vendored skills. Accepts the union of frontmatter
 *   keys used by this repository and upstream, validates field types, rejects
 *   unfinished TODO placeholders anywhere in the instructions, and does not
 *   require the frontmatter name to equal the directory name (vendored skills
 *   may be renamed).
 * - `adapter` (`--skill`): the upstream Codex allow-list, ported from
 *   skill-creator's `quick_validate.py`. Used to confirm an adapter directory
 *   still passes the stricter upstream contract.
 *
 * Usage:
 *   node scripts/validate-skills.mjs                  # scan repository roots
 *   node scripts/validate-skills.mjs --root <dir>     # scan another skills root
 *   node scripts/validate-skills.mjs --skill <dir>    # strict adapter check
 *
 * Exit codes: 0 valid, 1 validation or I/O failure, 2 usage error.
 */

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

/** Maximum accepted description length, matching upstream. */
const MAX_DESCRIPTION_LENGTH = 1024;
/** Maximum accepted skill name length, matching upstream. */
const MAX_SKILL_NAME_LENGTH = 64;
/** Frontmatter keys accepted by the strict upstream adapter check. */
const ADAPTER_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
]);
/** Frontmatter keys accepted for vendored repository skills. */
const REPO_FRONTMATTER_KEYS = new Set([
  ...ADAPTER_FRONTMATTER_KEYS,
  "disable-model-invocation",
  "argument-hint",
]);

/** Opening `---`, captured body, and the closing fence. */
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---/;
/** Unfinished placeholder marker. */
const TODO_PATTERN = /\[TODO:[^\n]*\]/;
/** Optional list bullet before a code fence. */
const FENCE_PATTERN = /^[ \t]*(?:(?:[-+*]|\d+[.)])[ \t]+)?(`{3,}|~{3,})(.*)$/;
/** A whole-line TODO placeholder outside fenced code. */
const TODO_LINE_PATTERN = /^[ ]{0,3}\[TODO:[^\n]*\][ \t]*$/;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Shared project skill directory scanned when no explicit target is given. */
const defaultSkillRoot = resolve(repositoryRoot, ".agents", "skills");

/**
 * Parse a YAML frontmatter block into a mapping.
 *
 * Walkthrough:
 * 1. Match the opening `---` line and the first following closing line.
 * 2. Report a `format` error when no block is present.
 * 3. Parse the captured YAML; report a `yaml` error with the first line only,
 *    because the library appends a noisy source excerpt.
 * 4. Accept only plain mappings; report `mapping` otherwise.
 *
 * @param {string} content Full SKILL.md text.
 * @returns {{frontmatter: Record<string, unknown>, bodyOffset: number} |
 *   {error: {kind: "format"} | {kind: "mapping"} | {kind: "yaml", detail: string}}}
 *   Parsed mapping plus the index just past the closing fence, or a typed error.
 */
function parseFrontmatter(content) {
  const match = FRONTMATTER_PATTERN.exec(content);
  if (!match) return { error: { kind: "format" } };

  let parsed;
  try {
    parsed = parseYaml(match[1]);
  } catch (error) {
    return { error: { kind: "yaml", detail: String(error.message).split("\n")[0] } };
  }

  if (!isMapping(parsed)) return { error: { kind: "mapping" } };
  return { frontmatter: parsed, bodyOffset: match[0].length };
}

/**
 * Determine whether a parsed YAML value is a plain mapping.
 *
 * @param {unknown} value Any parsed YAML value.
 * @returns {value is Record<string, unknown>} True for non-array objects.
 */
function isMapping(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Render a typed frontmatter error in the wording for one check profile.
 *
 * @param {{kind: "format"} | {kind: "mapping"} | {kind: "yaml", detail: string}} error Typed error.
 * @param {"repo" | "adapter"} profile Check profile.
 * @returns {string} Profile-appropriate diagnostic.
 */
function formatFrontmatterError(error, profile) {
  const upstream = profile === "adapter";
  if (error.kind === "format")
    return upstream ? "Invalid frontmatter format" : "invalid YAML frontmatter";
  if (error.kind === "mapping") {
    return upstream ? "Frontmatter must be a YAML mapping" : "frontmatter must be a YAML mapping";
  }
  return upstream
    ? `Invalid YAML in frontmatter: ${error.detail}`
    : `invalid YAML frontmatter: ${error.detail}`;
}

/**
 * Report frontmatter keys outside the profile's allow-list.
 *
 * @param {Record<string, unknown>} frontmatter Parsed frontmatter.
 * @param {Set<string>} allowedKeys Permitted key names.
 * @param {string} label Human-readable skill label.
 * @param {"repo" | "adapter"} profile Check profile.
 * @returns {string[]} Zero or one diagnostic.
 */
function checkAllowedKeys(frontmatter, allowedKeys, label, profile) {
  const unexpected = Object.keys(frontmatter)
    .filter((key) => !allowedKeys.has(key))
    .sort();
  if (unexpected.length === 0) return [];
  const prefix =
    profile === "adapter"
      ? "Unexpected key(s) in SKILL.md frontmatter: "
      : "unsupported frontmatter keys: ";
  return [`${label}: ${prefix}${unexpected.join(", ")}`];
}

/**
 * Validate the `name` field.
 *
 * Walkthrough:
 * 1. Require a string value; otherwise report the expected type.
 * 2. Trim it and report empty values.
 * 3. Enforce hyphen-case, no leading/trailing/double hyphen, and max length.
 * 4. Never compare it to the directory name; vendored skills may be renamed.
 *
 * @param {unknown} rawName Frontmatter `name` value.
 * @param {string} label Human-readable skill label.
 * @returns {string[]} Diagnostics; empty when valid.
 */
function validateNameField(rawName, label) {
  if (typeof rawName !== "string") return [`${label}: name must be a string`];
  const name = rawName.trim();
  if (name.length === 0) return [`${label}: name must be a non-empty string`];

  const errors = [];
  if (!/^[a-z0-9-]+$/.test(name)) {
    errors.push(
      `${label}: name '${name}' should be hyphen-case (lowercase letters, digits, and hyphens only)`,
    );
  }
  if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
    errors.push(
      `${label}: name '${name}' cannot start/end with hyphen or contain consecutive hyphens`,
    );
  }
  if (name.length > MAX_SKILL_NAME_LENGTH) {
    errors.push(
      `${label}: name is too long (${name.length} characters). Maximum is ${MAX_SKILL_NAME_LENGTH}`,
    );
  }
  return errors;
}

/**
 * Validate the `description` field.
 *
 * Walkthrough:
 * 1. Require a string value.
 * 2. Adapter profile also rejects a TODO prefix and angle brackets (upstream).
 * 3. Reject descriptions longer than the upstream maximum.
 * 4. Reject an empty description in both profiles.
 *
 * @param {unknown} rawDescription Frontmatter `description` value.
 * @param {string} label Human-readable skill label.
 * @param {"repo" | "adapter"} profile Check profile.
 * @returns {string[]} Diagnostics; empty when valid.
 */
function validateDescriptionField(rawDescription, label, profile) {
  if (typeof rawDescription !== "string") return [`${label}: description must be a string`];
  const description = rawDescription.trim();
  const errors = [];

  if (profile === "adapter") {
    if (description.startsWith("[TODO:")) {
      errors.push(`${label}: description contains an unfinished TODO placeholder`);
    }
    if (description.includes("<") || description.includes(">")) {
      errors.push(`${label}: description cannot contain angle brackets (< or >)`);
    }
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `${label}: description is too long (${description.length} characters). Maximum is ${MAX_DESCRIPTION_LENGTH}`,
    );
  }
  if (description.length === 0) {
    errors.push(`${label}: description must be a non-empty string`);
  }
  return errors;
}

/**
 * Scan instruction text for an unfinished TODO placeholder inside fenced code.
 *
 * Walkthrough:
 * 1. Walk the body line by line, tracking an open code fence.
 * 2. A fence line opens a fence; a matching fence of at least the same length
 *    with no info string closes it.
 * 3. Skip fenced content so documented examples stay valid.
 * 4. Outside fences, a whole-line `[TODO: ...]` placeholder fails the check.
 *
 * @param {string} body SKILL.md text after the frontmatter fence.
 * @returns {boolean} True when an unfinished placeholder is present.
 */
function hasUnfinishedTodo(body) {
  let fenceMarker = null;
  let fenceLength = 0;

  for (const line of body.split(/\r?\n/)) {
    const fence = FENCE_PATTERN.exec(line);
    if (fence) {
      const marker = fence[1];
      if (fenceMarker === null) {
        fenceMarker = marker[0];
        fenceLength = marker.length;
      } else if (
        marker[0] === fenceMarker &&
        marker.length >= fenceLength &&
        fence[2].trim() === ""
      ) {
        fenceMarker = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceMarker === null && TODO_LINE_PATTERN.test(line)) return true;
  }
  return false;
}

/**
 * Validate the optional `agents/openai.yaml` metadata file.
 *
 * Walkthrough:
 * 1. Skip when the path does not exist.
 * 2. Reject symlinks and non-regular files without reading them.
 * 3. Parse the file and require a YAML mapping.
 *
 * @param {string} skillPath Skill directory.
 * @param {string} label Skill label for diagnostics.
 * @returns {string[]} Diagnostics; empty when valid or absent.
 */
function validateAgentMetadata(skillPath, label) {
  const metadataPath = join(skillPath, "agents", "openai.yaml");
  if (!existsSync(metadataPath)) return [];

  const stat = lstatSync(metadataPath);
  if (stat.isSymbolicLink()) return [`${label}: agents/openai.yaml must not be a symlink`];
  if (!stat.isFile()) return [`${label}: agents/openai.yaml is not a regular file`];

  let parsed;
  try {
    parsed = parseYaml(readFileSync(metadataPath, "utf8"));
  } catch (error) {
    return [`${label}: invalid agents/openai.yaml: ${String(error.message).split("\n")[0]}`];
  }
  if (!isMapping(parsed)) return [`${label}: agents/openai.yaml must be a YAML mapping`];
  return [];
}

/**
 * Validate one skill directory.
 *
 * Walkthrough:
 * 1. Require a regular, non-symlink `SKILL.md`; never follow a symlinked file.
 * 2. Parse frontmatter; report a typed error using the profile's wording.
 * 3. Reject keys outside the profile's allow-list.
 * 4. Require and validate `name` and `description`.
 * 5. Repo profile also validates invocation/metadata field types.
 * 6. Scan instructions for an unfinished TODO (repo: anywhere; adapter:
 *    outside fenced code only).
 * 7. Validate `agents/openai.yaml` when present.
 *
 * @param {string} skillDirectory Directory containing SKILL.md.
 * @param {"repo" | "adapter"} profile Check profile.
 * @returns {string[]} Diagnostics; empty when valid.
 */
function validateSkill(skillDirectory, profile) {
  const label = relativeLabel(skillDirectory);
  const skillMarkdown = join(skillDirectory, "SKILL.md");

  if (!existsSync(skillMarkdown)) return [`${label}: SKILL.md not found`];
  const markdownStat = lstatSync(skillMarkdown);
  if (markdownStat.isSymbolicLink()) return [`${label}: SKILL.md must not be a symlink`];
  if (!markdownStat.isFile()) return [`${label}: SKILL.md is not a regular file`];

  let content;
  try {
    content = readFileSync(skillMarkdown, "utf8");
  } catch (error) {
    return [`${label}: could not read SKILL.md: ${error.message}`];
  }

  if (profile === "adapter" && !content.startsWith("---")) {
    return [`${label}: No YAML frontmatter found`];
  }

  const parsed = parseFrontmatter(content);
  if ("error" in parsed) return [`${label}: ${formatFrontmatterError(parsed.error, profile)}`];
  const { frontmatter, bodyOffset } = parsed;
  const allowedKeys = profile === "adapter" ? ADAPTER_FRONTMATTER_KEYS : REPO_FRONTMATTER_KEYS;

  const errors = checkAllowedKeys(frontmatter, allowedKeys, label, profile);

  if (!("name" in frontmatter)) {
    errors.push(`${label}: Missing 'name' in frontmatter`);
  } else {
    errors.push(...validateNameField(frontmatter.name, label));
  }

  if (!("description" in frontmatter)) {
    errors.push(`${label}: Missing 'description' in frontmatter`);
  } else {
    errors.push(...validateDescriptionField(frontmatter.description, label, profile));
  }

  if (profile === "repo") {
    const invocation = frontmatter["disable-model-invocation"];
    if (invocation !== undefined && typeof invocation !== "boolean") {
      errors.push(`${label}: disable-model-invocation must be boolean`);
    }
    const hint = frontmatter["argument-hint"];
    if (hint !== undefined && typeof hint !== "string") {
      errors.push(`${label}: argument-hint must be a string`);
    }
    if (frontmatter.metadata !== undefined && !isMapping(frontmatter.metadata)) {
      errors.push(`${label}: metadata must be a YAML mapping`);
    }
  }

  const body = content.slice(bodyOffset);
  const hasTodo = profile === "adapter" ? hasUnfinishedTodo(body) : TODO_PATTERN.test(body);
  if (hasTodo) {
    errors.push(`${label}: instructions contain an unfinished TODO placeholder`);
  }

  errors.push(...validateAgentMetadata(skillDirectory, label));
  return errors;
}

/**
 * Scan a skills root for immediate child directories containing SKILL.md.
 *
 * Walkthrough:
 * 1. Require the root directory to exist; a missing root is an error.
 * 2. List entries without following symlinks.
 * 3. Skip symlinked directories (reported as ignored, never traversed) and
 *    plain files.
 * 4. A child directory without SKILL.md is reported as ignored, not invalid.
 * 5. Validate each remaining skill directory and return counts plus ignored
 *    names so successful runs still show what was skipped.
 *
 * @param {string} root Skills root to scan.
 * @returns {{errors: string[], validated: number, symlinks: string[], nonSkills: string[]}}
 *   Diagnostics and scan counts.
 */
function scanSkillsRoot(root) {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    return {
      errors: [`skills directory not found: ${relativeLabel(root)}`],
      validated: 0,
      symlinks: [],
      nonSkills: [],
    };
  }

  const errors = [];
  const symlinks = [];
  const nonSkills = [];
  let validated = 0;

  const entries = readdirSync(root, { withFileTypes: true }).sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );

  for (const entry of entries) {
    const entryPath = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      symlinks.push(entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (!existsSync(join(entryPath, "SKILL.md"))) {
      nonSkills.push(entry.name);
      continue;
    }
    const skillErrors = validateSkill(entryPath, "repo");
    errors.push(...skillErrors);
    if (skillErrors.length === 0) validated += 1;
  }

  return { errors, validated, symlinks, nonSkills };
}

/**
 * Format a path relative to the repository when possible.
 *
 * @param {string} target Absolute path.
 * @returns {string} Repository-relative label, or the basename for fixtures.
 */
function relativeLabel(target) {
  const absolute = resolve(target);
  if (absolute === repositoryRoot) return ".";
  if (absolute.startsWith(`${repositoryRoot}${sep}`))
    return absolute.slice(repositoryRoot.length + 1);
  return basename(absolute);
}

/**
 * Parse command-line arguments into validation targets.
 *
 * Walkthrough:
 * 1. Walk arguments in order.
 * 2. `--root <dir>` adds a skills root to scan; `--skill <dir>` adds one
 *    strict adapter target.
 * 3. `--help`/`-h` requests usage; unknown flags or missing values are errors.
 * 4. With no explicit targets, scan the repository's shared skill directory.
 *
 * @param {string[]} argv Arguments after the script name.
 * @returns {{mode: "help"} | {mode: "error", message: string} |
 *   {mode: "run", roots: string[], skills: string[]}} Parsed request.
 */
function parseArguments(argv) {
  const roots = [];
  const skills = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { mode: "help" };
    if (argument === "--root" || argument === "--skill") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { mode: "error", message: `Missing value for ${argument}` };
      }
      if (argument === "--root") roots.push(resolve(value));
      else skills.push(resolve(value));
      index += 1;
      continue;
    }
    return { mode: "error", message: `Unknown argument: ${argument}` };
  }

  if (roots.length === 0 && skills.length === 0) {
    return { mode: "run", roots: [defaultSkillRoot], skills: [] };
  }
  return { mode: "run", roots, skills };
}

/** Usage text printed for `--help` and usage errors. */
const USAGE = [
  "Usage: node scripts/validate-skills.mjs [--root <skills-directory>] [--skill <skill-directory>]",
  "",
  "  --root    Scan immediate child skill directories under this path.",
  "  --skill   Validate one skill directory with the strict upstream rules.",
  "  --help    Show this message.",
  "",
  "With no arguments, scans .agents/skills.",
].join("\n");

/**
 * Format a successful scan summary, naming what was skipped.
 *
 * @param {string} root Scanned root.
 * @param {{validated: number, symlinks: string[], nonSkills: string[]}} scan Scan result.
 * @returns {string} One-line summary.
 */
function formatScanSummary(root, scan) {
  const parts = [];
  if (scan.symlinks.length > 0) {
    parts.push(
      `${scan.symlinks.length} symlink${scan.symlinks.length === 1 ? "" : "s"} not traversed`,
    );
  }
  if (scan.nonSkills.length > 0) {
    parts.push(
      `${scan.nonSkills.length} entr${scan.nonSkills.length === 1 ? "y" : "ies"} without SKILL.md`,
    );
  }
  const suffix = parts.length > 0 ? ` (ignored: ${parts.join(", ")})` : "";
  return `Validated ${scan.validated} skills in ${relativeLabel(root)}${suffix}.`;
}

/**
 * Run the requested checks and report diagnostics.
 *
 * @param {string[]} argv Arguments after the script name.
 * @returns {number} Process exit code.
 */
function main(argv) {
  const request = parseArguments(argv);
  if (request.mode === "help") {
    console.log(USAGE);
    return 0;
  }
  if (request.mode === "error") {
    console.log(`${request.message}\n\n${USAGE}`);
    return 2;
  }

  const errors = [];
  const summaries = [];

  for (const root of request.roots) {
    const scan = scanSkillsRoot(root);
    errors.push(...scan.errors);
    if (scan.errors.length === 0) summaries.push(formatScanSummary(root, scan));
  }
  for (const skill of request.skills) {
    const skillErrors = validateSkill(skill, "adapter");
    errors.push(...skillErrors);
    if (skillErrors.length === 0)
      summaries.push(`Validated skill adapter: ${relativeLabel(skill)}`);
  }

  if (errors.length > 0) {
    console.log("Skill validation failed:");
    for (const error of errors) console.log(`- ${error}`);
    return 1;
  }

  for (const summary of summaries) console.log(summary);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
