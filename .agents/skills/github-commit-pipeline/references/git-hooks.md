# Git Hook Reference

Treat repository-managed hooks as a required local commit boundary.

Before committing:

1. Inspect `git config --local --get core.hooksPath`.
2. Read the configured `pre-commit` and `pre-push` scripts.
3. Run the documented hook setup command when the path is not active:
   `npm run setup:git-hooks`.
4. Re-read the configuration and confirm both hooks exist and are executable.

The pre-commit hook validates the staged change through
`scripts/validate-commit.ts`. The pre-push hook audits every outgoing ref update
through `scripts/audit-one-file-history.ts` and rejects the repository's defined
history violations in the outgoing range. It must handle both existing remote
tips and new branches.

Keep hooks active for every commit. Never use `--no-verify`, remove or rename
versioned hooks, or change `core.hooksPath` to bypass them. A missing hook or a
failed hook is a stop condition, not something to work around.
