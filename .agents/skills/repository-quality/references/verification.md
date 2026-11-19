# Verification

- Use the narrowest fixed repository verification that covers the change.
- Repository-tooling changes require `npm run docs:check`, `npm run skills:check`, and `npm run test:tooling`.
- Documentation changes require `npm run docs:check`.
- Application changes require the relevant workspace typecheck, lint, build, and rendered-state checks.
- Run `npm run setup:git-hooks` before committing. Keep `core.hooksPath=.githooks` active.
- Commit with reviewed paths and clear subjects. Never bypass hooks or use `--no-verify`.
- Do not deploy, push, apply remote D1 migrations, or access Cloudflare credentials as part of local verification.
