---
title: Stage 2 — Token and Secret Lifecycle
aliases: [Portfolio MCP installation token lifecycle]
tags: [plan, github, cloudflare]
role: project-plan-stage
status: planned
plan_id: portfolio-mcp-github-app-rate-limit-hardening
stage: 2
milestone: M2
owner: Operator-Syn
risk: high
depends_on: [stage-1-github-app]
---

# Stage 2 — Token and Secret Lifecycle

## Objective

Give the Worker a server-side credential path without exposing the App private key or installation token to clients, logs, tests, source control, or portfolio responses.

## Secret contract

| Name | Sensitivity | Purpose |
| --- | --- | --- |
| `GITHUB_APP_ID` | identifier | App issuer for JWT signing |
| `GITHUB_INSTALLATION_ID` | deployment identifier | Selects the App installation under Operator-Syn |
| `GITHUB_INSTALLATION_OWNER` | non-secret configuration | Exact allowed repository owner (`Operator-Syn`) |
| `GITHUB_APP_PRIVATE_KEY` | secret | Signs the short-lived App JWT |

Store the private key through Cloudflare Worker Secrets. For local development use the ignored `.dev.vars` mechanism; never put values in `wrangler.toml`, `vars`, fixtures, snapshots, or the vault.

## Token provider

1. Build an RS256 App JWT with App ID issuer, slight issued-at clock-skew tolerance, and expiry no more than ten minutes after issuance.
2. Resolve the requested repository scope against `GITHUB_INSTALLATION_OWNER`; reject another owner before token exchange.
3. Exchange the JWT at GitHub's installation-token endpoint with exactly one repository name and `contents: read` permission.
4. If GitHub returns repository-scope data, require exactly the requested repository; reject missing, multiple, or mismatched scopes.
5. Cache tokens per repository in isolate memory; never assume an isolate is permanent or shared.
6. Refresh each repository token before the one-hour expiry and never refresh on every GitHub request.
7. Deduplicate simultaneous refreshes independently for each repository.
8. On a `401`, invalidate only the token used for that repository, perform one bounded refresh, and retry once.
9. If credentials are missing or refresh fails, fail closed with the existing bounded internal error; do not fall back to unauthenticated GitHub.

## Tests

- Mocked JWT claims and signing with a fixed clock.
- One-repository token body with `contents: read` and no broader repository scope.
- Independent per-repository caches and one in-flight refresh per repository.
- Owner rejection before exchange and repository-scope response validation.
- Rejected exchange, missing secret, malformed PEM, and expired-token failure paths.
- Secret scanning confirms no key, JWT, token, or full bearer header appears in output.

## Exit gate — M2

Mark `verified` only when secret names and ownership are documented, local/production paths are distinct, mocked exchange/expiry/failure tests pass, and secret-scanning review is clean.

## User-owned operations

The operator creates or updates Cloudflare secrets and authorizes production deployment. This plan does not execute those operations or record their values.

## References

- [[plans/portfolio-mcp-github-app/references|Plan references]]
- [Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [GitHub installation-token endpoint](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)
