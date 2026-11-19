---
name: github-commit-pipeline
description: Safely prepare, verify, and commit local Git changes with versioned hooks active.
---

# Git Commit Pipeline

Use this skill for local repository changes and commits. Keep pushing,
publishing, pull requests, merging, releasing, deploying, and database
migration application as separately authorized actions.

## Required workflow

1. Read the nearest instructions and canonical documentation.
2. Inspect Git status, including untracked files, before preparing anything.
3. Review the exact paths, content, and diff being committed; confirm with the
   user before destructive operations or anything outside the requested scope.
4. Run the narrowest repository-native verification that covers the change.
   Do not commit failed or stale work.
5. Verify the versioned Git hook path immediately before committing.
6. Stage the reviewed paths and write a clear sentence-style commit subject.
7. Commit with the hooks active, then report the commit ID, hook status,
   verification results, and any partial progress. Treat later GitHub actions
   as a new request.

Read the focused references when needed:

- [Git hooks](references/git-hooks.md) for activation and history enforcement.
- [Workflows](references/workflows.md) for reviewed local change and commit flow.

Never use `git commit --no-verify`, change `core.hooksPath` to bypass the
repository boundary, expose secrets, or silently exclude unrelated dirty paths.
