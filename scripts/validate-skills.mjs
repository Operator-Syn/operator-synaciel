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
const skills = [".agents/skills/repository-quality", ".codex/skills/repository-quality"];

function validateSkill(skill) {
  const command = process.platform === "win32" ? "pipenv.exe" : "pipenv";
  const result = spawnSync(command, ["run", "python", validator, skill], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`Could not run the skill validator for ${skill}: ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(validator)) {
    console.error(`Skill validator not found: ${validator}`);
    console.error(
      "Install the repository skill prerequisites or set CODEX_SKILL_VALIDATOR to quick_validate.py.",
    );
    process.exitCode = 1;
  } else {
    const valid = skills.every(validateSkill);
    if (!valid) process.exitCode = 1;
  }
}
