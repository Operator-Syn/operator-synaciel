# Git Hook Reference

Treat repository-managed hooks as a required local commit boundary.

Before committing:

1. Inspect `git config --local --get core.hooksPath`.
2. Read the configured `pre-commit` and `pre-push` scripts.
3. Run the documented hook setup command when the path is not active.
4. Re-read the configuration and confirm both hooks exist and are executable.

The pre-commit hook should reject zero or multiple staged paths. Restricted
developer paths require the adapter's short-lived internal approval marker.
The marker must not be invented, persisted, or returned by the MCP.

The pre-push hook should audit every outgoing ref update and reject the
repository's defined history violations, commonly merge, empty, and
multi-path commits. It must handle both existing remote tips and new branches.

Keep hooks active for MCP-created commits. Never use `--no-verify`, remove or
rename versioned hooks, or change `core.hooksPath` to bypass them.
