import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const helperPath = resolve(repositoryRoot, ".codex/hooks/repository-dev-shell.sh");
const sessionHookPath = resolve(repositoryRoot, ".codex/hooks/repository-session-start.sh");
const bashPath = execFileSync("bash", ["-lc", "command -v bash"], {
  encoding: "utf8",
}).trim();
const temporaryPaths: string[] = [];
const guardedEnvrc = "if command -v nix >/dev/null 2>&1; then\n  use flake\nfi\n";

type EnvironmentOverrides = Record<string, string | null>;

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "operator-synaciel-dev-shell-"));
  temporaryPaths.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, content, "utf8");
  }
  return root;
}

async function fakeNixPath() {
  const bin = await mkdtemp(join(tmpdir(), "operator-synaciel-fake-nix-"));
  temporaryPaths.push(bin);
  const nix = join(bin, "nix");
  await writeFile(nix, "#!/usr/bin/env bash\nexit 0\n", "utf8");
  await chmod(nix, 0o755);
  return bin;
}

function runHelper(root: string, overrides: EnvironmentOverrides = {}) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete env[key];
    else env[key] = value;
  }
  return spawnSync(bashPath, [helperPath, root], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env,
  });
}

function supportedFlake() {
  return (
    'systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];\n' +
    "export PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers\n" +
    "export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1\n"
  );
}

function currentNixSystem() {
  const os = process.platform;
  const arch = process.arch;
  if (os === "linux" && arch === "x64") return "x86_64-linux";
  if (os === "linux" && arch === "arm64") return "aarch64-linux";
  if (os === "darwin" && arch === "x64") return "x86_64-darwin";
  if (os === "darwin" && arch === "arm64") return "aarch64-darwin";
  return null;
}

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

test("stays silent when no repository shell marker exists", async () => {
  const root = await fixture({});
  const result = runHelper(root, { PATH: "" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("recognizes only the guarded envrc and recommends a compatible flake shell", async () => {
  const root = await fixture({ "flake.nix": supportedFlake(), ".envrc": guardedEnvrc });
  const fakePath = await fakeNixPath();
  const result = runHelper(root, {
    PATH: fakePath,
    IN_NIX_SHELL: null,
    DIRENV_DIR: null,
  });

  assert.equal(result.status, 0);
  if (currentNixSystem()) {
    assert.match(
      result.stdout,
      /Compatible repository dev shell detected \(flake\.nix \+ guarded \.envrc,/,
    );
    assert.match(result.stdout, /nix develop --command <command>/);
    assert.match(result.stdout, /does not provide Node\/npm\/Python\/Pipenv/);
  } else {
    assert.match(result.stdout, /compatibility with the current host is unconfirmed/);
  }
  assert.equal(result.stderr, "");
});

test("reports a missing Nix runtime without blocking host commands", async () => {
  const root = await fixture({ "flake.nix": supportedFlake() });
  const result = runHelper(root, { PATH: "", IN_NIX_SHELL: null, DIRENV_DIR: null });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Nix is unavailable/);
  assert.doesNotMatch(result.stdout, /nix develop --command <command>/);
  assert.equal(result.stderr, "");
});

test("reports unconfirmed flake compatibility without recommending entry", async () => {
  const root = await fixture({
    "flake.nix": 'systems = [ "not-a-supported-system" ];\n',
  });
  const fakePath = await fakeNixPath();
  const result = runHelper(root, { PATH: fakePath, IN_NIX_SHELL: null, DIRENV_DIR: null });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /compatibility with .* is unconfirmed/);
  assert.doesNotMatch(result.stdout, /nix develop --command <command>/);
  assert.equal(result.stderr, "");
});

test("reports an already active Nix or direnv environment without nesting", async () => {
  const root = await fixture({ "flake.nix": supportedFlake() });
  const fakePath = await fakeNixPath();
  const result = runHelper(root, { PATH: fakePath, IN_NIX_SHELL: "1", DIRENV_DIR: null });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /already active/);
  assert.match(result.stdout, /Avoid nesting another shell/);
  assert.doesNotMatch(result.stdout, /nix develop --command <command>/);
  assert.equal(result.stderr, "");
});

test("recognizes a shell.nix marker but leaves compatibility unconfirmed", async () => {
  const root = await fixture({ "shell.nix": "{ }\n" });
  const fakePath = await fakeNixPath();
  const result = runHelper(root, { PATH: fakePath, IN_NIX_SHELL: null, DIRENV_DIR: null });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /shell\.nix/);
  assert.match(result.stdout, /compatibility with .* is unconfirmed/);
  assert.equal(result.stderr, "");
});

test("keeps both shell hooks syntactically valid and wires the session hook", async () => {
  for (const path of [helperPath, sessionHookPath]) {
    const syntax = spawnSync(bashPath, ["-n", path], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(syntax.status, 0, path);
    assert.equal(syntax.stderr, "");
  }

  const source = await readFile(sessionHookPath, "utf8");
  assert.match(source, /repository-dev-shell\.sh/);
  assert.match(source, /repository_root=/);

  const execution = spawnSync(bashPath, [sessionHookPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(execution.status, 0);
  assert.match(execution.stdout, /Operator-Synaciel repository workflow:/);
  assert.match(
    execution.stdout,
    /Repository dev shell marker|Compatible repository dev shell detected/,
  );
  assert.equal(execution.stderr, "");
});
