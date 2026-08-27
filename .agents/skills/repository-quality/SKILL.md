---
name: repository-quality
description: Keep Operator-Synaciel work source-grounded, visually intentional, and reviewable without speculative AI-generated code or documentation.
---

# Repository Quality

Use this skill for repository changes, audits, documentation, and interface work.

1. Read `AGENTS.md` and `docs/README.md` before editing.
2. For codebase questions, query the existing Graphify graph first, then confirm the cited source directly.
3. Use `repository_workflow_status` when the repository MCP is available; use its bounded prepare/apply/verify flow for edits.
4. Preserve real routes, API contracts, schema names, content, and assets. Do not invent data, placeholder copy, or speculative abstractions.
5. Update one focused canonical note instead of creating redundant documentation. Split a note only when it mixes independent concerns.
6. Verify the affected behavior, then review the complete diff and unrelated dirty paths before committing.

Load only the relevant reference:

- [Discovery](references/discovery.md) for Graphify, MCP, and vault navigation.
- [Anti-slop](references/anti-slop.md) for content, architecture, and UI quality decisions.
- [Verification](references/verification.md) for checks, hooks, and commit boundaries.
