#!/usr/bin/env bash

# Context-only hook. It does not gate reads or mutate the repository.
cat <<'EOF'
Operator-Synaciel repository workflow:
- Query graphify-out/graph.json first for codebase questions when it exists, then read the cited source directly.
- Use docs/README.md as the Obsidian vault map and keep durable documentation in focused notes.
- Use operator-synaciel-repository for guarded file changes and local one-file commits; review every path, hash, and diff.
- Direct shell git commit is intentionally routed through the repository MCP and versioned Git hooks.
- Keep Graphify updates, Cloudflare access, deployment, and database migration application outside the repository MCP.
EOF
