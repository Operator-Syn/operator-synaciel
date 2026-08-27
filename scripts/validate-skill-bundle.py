#!/usr/bin/env python3
"""Validate the project skill bundle recorded by skills-lock.json."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

MAX_DESCRIPTION_LENGTH = 1024
SUPPORTED_FRONTMATTER_KEYS = {
    "name",
    "description",
    "license",
    "allowed-tools",
    "metadata",
    "disable-model-invocation",
    "argument-hint",
}
FRONTMATTER_PATTERN = re.compile(r"^---\n(.*?)\n---(?:\n|$)", re.DOTALL)
TODO_PATTERN = re.compile(r"\[TODO:[^\n]*\]")


def validate_skill(skill_path: Path, expected_name: str, record: object) -> list[str]:
    errors: list[str] = []
    if not skill_path.exists():
        return [f"{expected_name}: skill directory is missing"]
    if skill_path.is_symlink():
        errors.append(f"{expected_name}: skill directory must not be a symlink")

    skill_md = skill_path / "SKILL.md"
    if not skill_md.is_file():
        errors.append(f"{expected_name}: SKILL.md is missing")
        return errors
    if skill_md.is_symlink():
        errors.append(f"{expected_name}: SKILL.md must not be a symlink")
        return errors

    content = skill_md.read_text(encoding="utf-8")
    match = FRONTMATTER_PATTERN.match(content)
    if not match:
        errors.append(f"{expected_name}: invalid YAML frontmatter")
        return errors

    try:
        frontmatter = yaml.safe_load(match.group(1))
    except yaml.YAMLError as error:
        errors.append(f"{expected_name}: invalid YAML frontmatter: {error}")
        return errors
    if not isinstance(frontmatter, dict):
        errors.append(f"{expected_name}: frontmatter must be a YAML mapping")
        return errors

    unexpected = set(frontmatter) - SUPPORTED_FRONTMATTER_KEYS
    if unexpected:
        errors.append(
            f"{expected_name}: unsupported frontmatter keys: {', '.join(sorted(unexpected))}"
        )

    name = frontmatter.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append(f"{expected_name}: frontmatter name must be a non-empty string")
    elif name.strip() != expected_name:
        errors.append(f"{expected_name}: frontmatter name is {name!r}")

    if not re.fullmatch(r"[a-z0-9-]{1,64}", expected_name):
        errors.append(f"{expected_name}: invalid directory name")
    if expected_name.startswith("-") or expected_name.endswith("-") or "--" in expected_name:
        errors.append(f"{expected_name}: invalid hyphenated name")

    description = frontmatter.get("description")
    if not isinstance(description, str) or not description.strip():
        errors.append(f"{expected_name}: description must be a non-empty string")
    elif len(description.strip()) > MAX_DESCRIPTION_LENGTH:
        errors.append(f"{expected_name}: description exceeds {MAX_DESCRIPTION_LENGTH} characters")

    invocation = frontmatter.get("disable-model-invocation")
    if invocation is not None and not isinstance(invocation, bool):
        errors.append(f"{expected_name}: disable-model-invocation must be boolean")
    hint = frontmatter.get("argument-hint")
    if hint is not None and not isinstance(hint, str):
        errors.append(f"{expected_name}: argument-hint must be a string")
    metadata = frontmatter.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        errors.append(f"{expected_name}: metadata must be a YAML mapping")

    if TODO_PATTERN.search(content[match.end() :]):
        errors.append(f"{expected_name}: instructions contain an unfinished TODO placeholder")

    agent_metadata = skill_path / "agents" / "openai.yaml"
    if agent_metadata.exists():
        if agent_metadata.is_symlink():
            errors.append(f"{expected_name}: agents/openai.yaml must not be a symlink")
        elif not agent_metadata.is_file():
            errors.append(f"{expected_name}: agents/openai.yaml is not a regular file")
        else:
            try:
                parsed_agent_metadata = yaml.safe_load(agent_metadata.read_text(encoding="utf-8"))
            except yaml.YAMLError as error:
                errors.append(f"{expected_name}: invalid agents/openai.yaml: {error}")
            else:
                if not isinstance(parsed_agent_metadata, dict):
                    errors.append(f"{expected_name}: agents/openai.yaml must be a YAML mapping")

    if not isinstance(record, dict):
        errors.append(f"{expected_name}: lockfile entry must be a mapping")
        return errors

    source = record.get("source")
    if not isinstance(source, str) or not source.strip():
        errors.append(f"{expected_name}: lockfile source is missing")
    source_type = record.get("sourceType")
    if not isinstance(source_type, str) or not source_type.strip():
        errors.append(f"{expected_name}: lockfile sourceType is missing")
    recorded_path = record.get("skillPath")
    if (
        not isinstance(recorded_path, str)
        or Path(recorded_path).is_absolute()
        or ".." in Path(recorded_path).parts
        or not recorded_path.endswith("/SKILL.md")
    ):
        errors.append(f"{expected_name}: lockfile skillPath is unsafe")
    computed_hash = record.get("computedHash")
    if not isinstance(computed_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", computed_hash):
        errors.append(f"{expected_name}: lockfile computedHash is invalid")

    return errors


def main(arguments: list[str]) -> int:
    if len(arguments) != 1:
        print("Usage: python validate-skill-bundle.py <skills-lock.json>")
        return 2

    lockfile = Path(arguments[0]).resolve()
    if not lockfile.is_file():
        print(f"Skill lockfile not found: {lockfile}")
        return 1

    try:
        lock = json.loads(lockfile.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"Could not read skill lockfile: {error}")
        return 1

    skills = lock.get("skills") if isinstance(lock, dict) else None
    if not isinstance(skills, dict) or not skills:
        print("Skill lockfile does not contain a skills mapping.")
        return 1

    root = lockfile.parent
    errors: list[str] = []
    for name, record in sorted(skills.items()):
        if not isinstance(name, str):
            errors.append("Skill lockfile contains a non-string skill name.")
            continue
        errors.extend(validate_skill(root / ".agents" / "skills" / name, name, record))

    if errors:
        print("Project skill bundle validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(skills)} locked project skills with compatible frontmatter and metadata.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
