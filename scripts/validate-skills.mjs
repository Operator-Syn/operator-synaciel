#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const codexHome = process.env.CODEX_HOME || resolve(homedir(), ".codex");
const validator =
  process.env.CODEX_SKILL_VALIDATOR ||
  resolve(codexHome, "skills", ".system", "skill-creator", "scripts", "quick_validate.py");
const bundleValidator = resolve(repositoryRoot, "scripts", "validate-skill-bundle.py");
const skillLockfile = resolve(repositoryRoot, "skills-lock.json");
const skills = [".agents/skills/repository-quality", ".codex/skills/repository-quality"];
const pythonCommand = process.platform === "win32" ? "pipenv.exe" : "pipenv";

function runPython(args) {
  const result = spawnSync(pythonCommand, ["run", "python", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`Could not run the Python skill validator: ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

function validateSkill(skill) {
  return runPython([validator, skill]);
}

function validateInstalledBundle() {
  if (!existsSync(bundleValidator)) {
    console.error(`Installed skill validator not found: ${bundleValidator}`);
    return false;
  }
  if (!existsSync(skillLockfile)) {
    console.error(`Skill lockfile not found: ${skillLockfile}`);
    return false;
  }
  return runPython([bundleValidator, skillLockfile]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(validator)) {
    console.error(`Skill validator not found: ${validator}`);
    console.error(
      "Install the repository skill prerequisites or set CODEX_SKILL_VALIDATOR to quick_validate.py.",
    );
    process.exitCode = 1;
  } else {
    const valid = skills.every(validateSkill) && validateInstalledBundle();
    if (!valid) process.exitCode = 1;
  }
}
