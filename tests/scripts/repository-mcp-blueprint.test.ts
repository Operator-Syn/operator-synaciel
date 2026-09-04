import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { test } from "node:test";

import {
  LOCAL_ONLY_MCP_TOOLS,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  REPOSITORY_VERIFICATION_PROFILES,
  REPOSITORY_WRITE_PROFILES,
} from "../../tools/repository-mcp/src/policy.ts";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const blueprintRoot = resolve(repositoryRoot, "docs/univsersal-repository-mcp-structure");

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

test("keeps the universal repository MCP blueprint aligned with source", async () => {
  const registry = await readFile(
    resolve(repositoryRoot, "tools/repository-mcp/src/tools/repository.ts"),
    "utf8",
  );
  const sourceFiles = (await collectFiles(resolve(repositoryRoot, "tools/repository-mcp/src")))
    .filter((path) => path.endsWith(".ts"))
    .map((path) => relative(repositoryRoot, path).replaceAll("\\", "/"));
  const blueprintFiles = await collectFiles(blueprintRoot);
  const markdownFiles = blueprintFiles.filter((path) => path.endsWith(".md"));
  const corpus = (await Promise.all(markdownFiles.map((path) => readFile(path, "utf8")))).join(
    "\n",
  );
  const index = await readFile(resolve(blueprintRoot, "README.md"), "utf8");
  const vocabulary = await readFile(
    resolve(blueprintRoot, "01-vocabulary-and-configuration.md"),
    "utf8",
  );

  const registeredTools = [...registry.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(new Set(registeredTools), LOCAL_ONLY_MCP_TOOLS);
  assert.equal(registeredTools.length, LOCAL_ONLY_MCP_TOOLS.size);
  for (const tool of registeredTools) {
    assert.ok(corpus.includes(tool), `Blueprint is missing tool mapping: ${tool}`);
  }

  assert.ok(corpus.includes(MCP_SERVER_NAME));
  assert.ok(corpus.includes(MCP_SERVER_VERSION));
  for (const profile of Object.keys(REPOSITORY_WRITE_PROFILES)) {
    assert.ok(corpus.includes(profile), `Blueprint is missing write/read profile: ${profile}`);
  }
  for (const profile of Object.keys(REPOSITORY_VERIFICATION_PROFILES)) {
    assert.ok(corpus.includes(profile), `Blueprint is missing verification profile: ${profile}`);
  }
  for (const sourceFile of sourceFiles) {
    const shortPath = sourceFile.replace("tools/repository-mcp/", "");
    assert.ok(
      corpus.includes(sourceFile) || corpus.includes(shortPath),
      `Blueprint is missing source module: ${sourceFile}`,
    );
  }

  for (const placeholder of [
    "{{SERVER_NAME}}",
    "{{PROJECT_ROOT_ENV}}",
    "{{TRANSPORT}}",
    "{{PROFILE_REGISTRY}}",
    "{{VERIFICATION_REGISTRY}}",
  ]) {
    assert.ok(vocabulary.includes(placeholder), `Missing universal placeholder: ${placeholder}`);
  }

  assert.match(index, /local repository MCP/i);
  assert.match(index, /no public HTTP endpoint/i);
  assert.match(index, /sequential implementation/i);
  assert.ok(await readFile(resolve(blueprintRoot, "audits/evidence-ledger.md"), "utf8"));
});
