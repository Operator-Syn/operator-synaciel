#!/usr/bin/env bash

# Context-only hook. It does not gate reads or mutate the repository.
cat <<'EOF'
Operator-Synaciel repository workflow:
- Start with repository_workflow_status before mutation.
- Query graphify-out/graph.json first for codebase questions when it exists, using a narrow context_filter, shallow depth, and explicit token budget, then read the cited source directly.
- Use docs/README.md as the Obsidian vault map and keep durable documentation in focused notes.
- Use .mcp.json for clone-shared MCP registration and .codex/config.toml for Codex-specific approval policy.
- Use operator-synaciel-repository for guarded file changes and local one-file commits; review every path, hash, byte count, and bounded diff chunk.
- After apply, run the matching fixed verification profile before preparing or committing subjects.
- Use prepare_working_tree_commit directly for dirty-tree commits; use prepare_commits only after an applied-change operation.
- Direct shell git commit is intentionally routed through the repository MCP and versioned Git hooks.
- Keep Graphify updates, Cloudflare access, deployment, and database migration application outside the repository MCP.
EOF
