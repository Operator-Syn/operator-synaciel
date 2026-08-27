# Verification

- Use the narrowest fixed repository verification profile that covers the change.
- MCP/config changes require `npm run mcp:check`, `npm run mcp:typecheck`, and `npm run test:mcp`.
- Documentation changes require `npm run docs:check`.
- Application changes require the relevant typecheck, lint, build, and rendered-state checks.
- Run `npm run setup:git-hooks` before committing. Keep `core.hooksPath=.githooks` active.
- Commit through the guarded repository MCP with exact reviewed paths, hashes, approval values, and one sentence-style subject per file. Never bypass hooks or use `--no-verify`.
- Do not deploy, push, apply remote D1 migrations, or access Cloudflare credentials as part of local verification.
