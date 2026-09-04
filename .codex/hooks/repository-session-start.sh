#!/usr/bin/env bash

# Context-only hook. It does not gate reads or mutate the repository.
cat <<'EOF'
Operator-Synaciel repository workflow:
- Start with repository_workflow_status before mutation.
- Query graphify-out/graph.json first for codebase questions when it exists, using a narrow context_filter, shallow depth, and explicit token budget, then read the cited source directly.
- Use docs/README.md as the Obsidian vault map and keep durable documentation in focused notes.
- Use .mcp.json for clone-shared MCP registration and .codex/config.toml for Codex-specific approval policy.
- Use operator-synaciel-repository for guarded file changes and local one-file commits; review every path, hash, byte count, and bounded diff chunk.
- After apply, use mcp-fast for quick MCP configuration/typecheck feedback, then run the matching full fixed profile before preparing or committing subjects.
- Use read_repository_files for bounded batches of complete source snapshots instead of duplicating large terminal output.
- Use prepare_working_tree_commit directly for dirty-tree commits; use prepare_commits only after an applied-change operation.
- Direct shell git commit is intentionally routed through the repository MCP and versioned Git hooks.
- Keep Graphify updates, Cloudflare access, deployment, and database migration application outside the repository MCP.
EOF

repository_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
dev_shell_hook="$repository_root/.codex/hooks/repository-dev-shell.sh"
if [[ -f "$dev_shell_hook" ]]; then
  bash "$dev_shell_hook" "$repository_root" || true
fi
