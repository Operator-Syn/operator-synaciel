#!/usr/bin/env bash

# Context-only hook. It does not gate reads or mutate the repository.
cat <<'EOF'
Operator-Synaciel repository workflow:
- Start with docs/README.md as the Obsidian vault map and keep durable documentation in focused notes.
- Stage exactly one path per commit; the versioned .githooks/pre-commit hook enforces it.
- Restricted developer directories (.agents, .codex, .impeccable, .obsidian) need an explicit approval marker before they can be committed.
- Run the matching fixed verification profile before committing, then npm run test:tooling for repository tooling.
- Keep Cloudflare access, deployment, and database migration application outside local tooling.
EOF

repository_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
dev_shell_hook="$repository_root/.codex/hooks/repository-dev-shell.sh"
if [[ -f "$dev_shell_hook" ]]; then
  bash "$dev_shell_hook" "$repository_root" || true
fi
