import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(repositoryRoot, "scripts", "validate-skills.mjs");

// An empty PATH directory proves the checker no longer needs Python, Pipenv, or
// a Codex home checkout: the CLI is invoked by absolute Node path, so nothing
// can resolve a system interpreter.
let emptyPathDirectory = "";

function skillMarkdown(frontmatter: string[], body: string[] = ["Use this skill.", ""]) {
  return ["---", ...frontmatter, "---", ...body].join("\n");
}

const validFrontmatter = ["name: fixture-skill", "description: A valid repository skill fixture."];

async function createScanRoot() {
  return mkdtemp(join(tmpdir(), "operator-synaciel-scan-"));
}

/** Write one skill directory under a root, with optional agents metadata. */
async function writeSkill(
  root: string,
  directory: string,
  markdown: string,
  metadata?: string | null,
) {
  const skillDirectory = join(root, directory);
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(join(skillDirectory, "SKILL.md"), markdown, "utf8");
  if (metadata !== null) {
    await mkdir(join(skillDirectory, "agents"), { recursive: true });
    await writeFile(
      join(skillDirectory, "agents", "openai.yaml"),
      metadata ?? "interface:\n  display_name: Fixture\n",
      "utf8",
    );
  }
  return skillDirectory;
}

function runCli(args: string[], pathValue: string, cwd = repositoryRoot) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, PATH: pathValue },
  });
}

describe("project skill validation (Node-only)", () => {
  before(async () => {
    emptyPathDirectory = await mkdtemp(join(tmpdir(), "operator-synaciel-empty-path-"));
  });

  after(async () => {
    await rm(emptyPathDirectory, { recursive: true, force: true });
  });

  test("scans only the shared repository skill directory without Python", () => {
    // Confidence check: the restricted PATH really has no python.
    const python = spawnSync("python3", ["-V"], {
      encoding: "utf8",
      shell: false,
      env: { ...process.env, PATH: emptyPathDirectory },
    });
    assert.ok(python.error, "expected python3 to be unavailable on the restricted PATH");

    // The default must work with no separate Codex skill directory.
    const result = runCli([], emptyPathDirectory);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Validated \d+ skills in \.agents\/skills/);
    assert.doesNotMatch(result.stdout, /\.codex\/skills/);
  });

  test("accepts invocation and argument-hint frontmatter in a scanned skill", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(
        root,
        "fixture-skill",
        skillMarkdown([
          ...validFrontmatter,
          "disable-model-invocation: true",
          'argument-hint: "A plan"',
        ]),
      );
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /Validated 1 skills/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("ignores non-skill directories and stray files", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(root, "fixture-skill", skillMarkdown(validFrontmatter));
      await mkdir(join(root, "notes-only"));
      await writeFile(join(root, "README.md"), "Not a skill.\n", "utf8");
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /Validated 1 skills in/);
      assert.match(result.stdout, /1 entry without SKILL\.md/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("does not traverse a symlinked skill directory", async () => {
    const root = await createScanRoot();
    const outside = await createScanRoot();
    try {
      // The linked skill is invalid; if it were traversed the run would fail.
      await writeSkill(outside, "linked-skill", skillMarkdown(["name: linked-skill"]));
      await symlink(join(outside, "linked-skill"), join(root, "linked-skill"));
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /1 symlink not traversed/);
      assert.doesNotMatch(result.stdout, /description/);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  test("accepts a vendored skill whose directory name differs from its frontmatter name", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(
        root,
        "renamed-directory",
        skillMarkdown(["name: original-skill", "description: Vendored under another name."]),
      );
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a scanned skill with a missing description", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(root, "fixture-skill", skillMarkdown(["name: fixture-skill"]));
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /Missing 'description'/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects non-mapping metadata", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(
        root,
        "fixture-skill",
        skillMarkdown([...validFrontmatter, "metadata: nope"]),
      );
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /metadata must be a YAML mapping/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects an unfinished TODO placeholder anywhere in scanned instructions", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(
        root,
        "fixture-skill",
        skillMarkdown(validFrontmatter, ["```text", "[TODO: example]", "```", ""]),
      );
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /TODO placeholder/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects an invalid hyphenated skill name", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(
        root,
        "fixture-skill",
        skillMarkdown(["name: Fixture_Skill", "description: Invalid name fixture."]),
      );
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /hyphen-case/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects non-mapping agents metadata", async () => {
    const root = await createScanRoot();
    try {
      await writeSkill(root, "fixture-skill", skillMarkdown(validFrontmatter), "just-a-string\n");
      const result = runCli(["--root", root], emptyPathDirectory);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /agents\/openai\.yaml must be a YAML mapping/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("reports a missing skills root", () => {
    const missing = join(emptyPathDirectory, "does-not-exist");
    const result = runCli(["--root", missing], emptyPathDirectory);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /skills directory not found/);
  });

  test("strict adapter mode accepts upstream-allowed frontmatter", async () => {
    const root = await createScanRoot();
    try {
      const skillDirectory = await writeSkill(
        root,
        "adapter-skill",
        skillMarkdown([
          "name: adapter-skill",
          "description: A valid adapter fixture.",
          "license: MIT",
          "allowed-tools: Read, Grep",
        ]),
      );
      const result = runCli(["--skill", skillDirectory], emptyPathDirectory);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("strict adapter mode rejects keys the upstream contract disallows", async () => {
    const root = await createScanRoot();
    try {
      const skillDirectory = await writeSkill(
        root,
        "adapter-skill",
        skillMarkdown([
          "name: adapter-skill",
          "description: A valid adapter fixture.",
          "disable-model-invocation: true",
        ]),
      );
      const result = runCli(["--skill", skillDirectory], emptyPathDirectory);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /Unexpected key/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("strict adapter mode ignores TODO text inside a fenced code block", async () => {
    const root = await createScanRoot();
    try {
      const skillDirectory = await writeSkill(
        root,
        "adapter-skill",
        skillMarkdown(
          ["name: adapter-skill", "description: A valid adapter fixture."],
          ["```text", "[TODO: example, not a placeholder]", "```", ""],
        ),
      );
      const result = runCli(["--skill", skillDirectory], emptyPathDirectory);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("reports usage errors with exit code 2", () => {
    const result = runCli(["--unknown"], emptyPathDirectory);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /Usage/);
  });
});
