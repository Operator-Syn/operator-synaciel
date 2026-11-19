---
name: repository-quality
description: Keep Operator-Synaciel work source-grounded, visually intentional, and reviewable without speculative AI-generated code or documentation.
---

# Repository Quality

Use this skill for repository changes, audits, documentation, and interface work.

1. Read `AGENTS.md` and `docs/README.md` before editing.
2. For codebase questions, locate the exact source, configuration, tests, and consumers directly; treat generated navigation aids as advisory. Tests live beside their owning workspace under `<workspace>/tests/`; shared repository-script tests live in `scripts/tests/`.
3. Keep changes bounded and reviewable: confirm the target paths and expected content before writing, ask before destructive or remote operations, and run the narrowest fixed checks that cover the change. For local commits, use `github-commit-pipeline`.
4. Preserve real routes, API contracts, schema names, content, and assets. Do not invent data, placeholder copy, or speculative abstractions.
5. Update one focused canonical note instead of creating redundant documentation. Split a note only when it mixes independent concerns.
6. Verify the affected behavior, then review the complete diff and unrelated dirty paths before committing.

Load only the relevant reference:

- [Discovery](references/discovery.md) for repository navigation and vault discovery.
- [Anti-slop](references/anti-slop.md) for content, architecture, and UI quality decisions.
- [Verification](references/verification.md) for checks, hooks, and commit boundaries.
