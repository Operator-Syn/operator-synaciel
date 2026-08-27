---
name: github-commit-pipeline
description: Safely prepare, verify, and commit local Git changes through a repository-local approval-gated MCP and versioned one-file hooks.
---

# Git Commit Pipeline

Use this skill for local repository changes and commits. Keep pushing,
publishing, pull requests, merging, releasing, deploying, and database
migration application as separately authorized actions.

## Required workflow

1. Read the nearest instructions and canonical documentation.
2. Inspect Git status, including untracked files, before preparing anything.
3. Call `repository_workflow_status` when available, then discover the local
   MCP tools, write profiles, verification profiles, hook
   setup command, restricted paths, and approval behavior.
4. Use bounded preparation for planned edits or complete working-tree
   preparation when the user asks to review the dirty tree.
5. Review every returned path, status, size, hash, diff, warning, and profile.
6. Apply only with the exact one-time token, expected hashes, and explicit
   approval required by the local adapter.
7. Run the narrowest repository-native verification profile that covers the
   change. Do not commit failed or stale work.
8. Verify the versioned Git hook path immediately before committing.
9. Provide exactly one reviewed sentence-style commit subject per reviewed
   path. Commit through the adapter one file at a time.
10. Report local commit IDs, hook status, verification results, and any
    partial progress. Treat later GitHub actions as a new request.

Read the focused references when needed:

- [MCP adapter](references/mcp-adapter.md) for hashes, approval, and capability mapping.
- [Git hooks](references/git-hooks.md) for activation and history enforcement.
- [Workflows](references/workflows.md) for bounded and dirty-tree operations.

Never use `git commit --no-verify`, change `core.hooksPath` to bypass the
repository boundary, expose approval values, or silently exclude unrelated
dirty paths.
