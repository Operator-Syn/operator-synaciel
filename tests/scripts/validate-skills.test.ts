import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const validator = join(repositoryRoot, "scripts", "validate-skill-bundle.py");
const pythonCommand = process.platform === "win32" ? "pipenv.exe" : "pipenv";

async function createFixture(skillMarkdown: string) {
  const root = await mkdtemp(join(tmpdir(), "operator-synaciel-skill-check-"));
  const skillDirectory = join(root, ".agents", "skills", "fixture-skill");
  await mkdir(join(skillDirectory, "agents"), { recursive: true });
  await writeFile(join(skillDirectory, "SKILL.md"), skillMarkdown, "utf8");
  await writeFile(
    join(skillDirectory, "agents", "openai.yaml"),
    "interface:\n  display_name: Fixture\n",
    "utf8",
  );
  await writeFile(
    join(root, "skills-lock.json"),
    `${JSON.stringify(
      {
        version: 1,
        skills: {
          "fixture-skill": {
            source: "fixture/source",
            sourceType: "github",
            skillPath: "skills/fixture-skill/SKILL.md",
            computedHash: "0".repeat(64),
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return root;
}

function runValidator(root: string) {
  return spawnSync(pythonCommand, ["run", "python", validator, join(root, "skills-lock.json")], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
  });
}

describe("project skill bundle validation", () => {
  test("accepts upstream invocation frontmatter fields", async () => {
    const skillMarkdown = [
      "---",
      "name: fixture-skill",
      "description: A valid project skill fixture.",
      "disable-model-invocation: true",
      'argument-hint: "A plan"',
      "---",
      "Use this skill.",
      "",
    ].join("\n");
    const root = await createFixture(skillMarkdown);
    try {
      const result = runValidator(root);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a locked skill with a mismatched frontmatter name", async () => {
    const skillMarkdown = [
      "---",
      "name: other-skill",
      "description: A valid project skill fixture.",
      "---",
      "Use this skill.",
      "",
    ].join("\n");
    const root = await createFixture(skillMarkdown);
    try {
      const result = runValidator(root);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /frontmatter name/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
