---
title: Local Development
tags:
  - operations
  - development
role: guide
---

# Local Development

Operator-Syn uses npm workspaces. Run commands from the repository root for
the stable orchestration aliases, or from a workspace when working directly
on one runtime.

## Install and application development

Install all workspace dependencies and start the portfolio frontend:

```bash
npm install
npm run dev
```

The frontend workspace is `apps/portfolio-web/`. Its Vite entrypoint is
`apps/portfolio-web/src/main.tsx`, its Pages Functions live in
`apps/portfolio-web/functions/`, and its local build output is
`apps/portfolio-web/dist/`.

Useful root checks are:

```bash
npm run typecheck
npm run lint
npm run check:biome
npm run build
npm run preview
```

## Local portfolio assistant

Vite development requires explicit assistant endpoints. To use the deployed
Workers from `npm run dev`, put these values in the ignored repository-root
`.env.local` file (the Vite configuration uses that root as its `envDir`):

```dotenv
VITE_PUBLIC_AUTH_URL=https://public-auth.syn-forge.com
VITE_PORTFOLIO_AGENT_URL=https://assistant.syn-forge.com
VITE_TURNSTILE_SITE_KEY=<production widget site key>
```

If either endpoint is missing or malformed in a development build, the FAB
shows a configuration error instead of redirecting to production. Production
builds use the explicit production defaults only when no production override
is provided. The production Worker `BROWSER_ORIGINS` values are parameterized
in the Wrangler files and include `http://localhost:5173` for this workflow;
they are not wildcard origins.

The production auth Worker uses a `Secure; HttpOnly; SameSite=None` session
cookie for this cross-site local-browser flow, while state-changing routes still
require the exact configured Origin. If Brave or another browser blocks
third-party cookies, allow cookies for `public-auth.syn-forge.com` during local
testing or use the isolated local Worker profile below.

The Google OAuth callback remains the production URI
`https://public-auth.syn-forge.com/oauth/google/callback`; the OAuth state stores
the localhost return target. The production Turnstile widget must allow the
`localhost` hostname, and its production site key must be paired with the
production `TURNSTILE_SECRET_KEY`. Do not use Cloudflare's dummy test keys with
the production Worker secret.

### Assistant connection troubleshooting

The Agents SDK resolves an asynchronous token query during the assistant
connection. The chat component is intentionally rendered under `Suspense` and
uses a short positive query cache so reconnects receive a fresh one-time token.
If the browser reports `An unknown Component is an async Client Component` at
`useAgent`, reload the current build and confirm the deployed Pages version
contains the assistant connection boundary. A token or WebSocket failure should
remain inside the assistant panel as `The assistant connection could not be
opened`; use its retry action or start a new thread. Chrome's `Fetch finished
loading` messages are informational; inspect the corresponding request status
before treating them as errors. Never paste session cookies, agent tokens, or
authorization headers into an issue or log.

### Optional: run isolated local Workers

If you do not want local Vite requests to use production authentication and
agent state, switch the two Vite endpoint values to `http://localhost:8787` and
`http://localhost:8788`, then run the local Workers and frontend in separate
terminals:

```bash
npx wrangler d1 migrations apply portfolio-agent-auth --local \
  --config workers/portfolio-public-auth/wrangler.toml --env local
npm run portfolio-agent:dev
npm run public-auth:dev
npm run dev
```

The local Wrangler profiles use `localhost:8787` for public-auth,
`localhost:8788` for the agent, and a local service binding between them. They
also pin the local compatibility date to the newest date supported by the
installed Wrangler runtime; the production compatibility date remains
unchanged. The shared local D1 database is keyed by the checked-in database ID
but is not the remote database when `--local` is used. Do not apply this command
with `--remote` as part of frontend testing.

Create or fill the ignored `.dev.vars` files beside each Worker Wrangler
configuration. This is needed only for the isolated local Worker profile.
Use local-only values for the Google client credentials, Turnstile secret,
ES256 JWK pair, and shared internal key; public-auth needs the private JWK and
the agent needs the matching public JWK. Never copy those values into the
frontend `.env` file or commit either `.dev.vars` file.

For the isolated local Worker profile, the Google OAuth client must allow
`http://localhost:5173` as an authorized JavaScript origin and
`http://localhost:8787/oauth/google/callback` as an authorized redirect URI.
The redirect URI must match that profile exactly. Use a local Turnstile
widget/site key for the localhost build; its secret remains only in
public-auth's `.dev.vars`.

The local profile intentionally points the unused admin-auth check at
`http://localhost:8789`; the existing Atelier/admin auth Worker is not started
by this workflow, so local admin reset endpoints remain unavailable and fail
closed.

Cloudflare Pages should use `apps/portfolio-web` as its project root, `npm run
build` as its build command, and `dist` as its output directory; Pages
Functions are discovered from the `functions/` directory at that workspace
root. Cloudflare Pages' monorepo support and Functions routing require that
project-root arrangement; this repository does not deploy Pages from the
legacy root layout.

## Portfolio API Worker

The Hono API Worker is the `workers/portfolio-api/` workspace. Its entrypoint
is `workers/portfolio-api/src/entrypoint.ts`; D1/R2 models and controllers
remain inside that workspace. Run its local Worker directly with:

```bash
npm run dev --workspace=@syn-forge/portfolio-api
```

The root API aliases delegate to this workspace:

```bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
npm run db:migrations:list:local
```

The checked-in Wrangler configuration is
`workers/portfolio-api/wrangler.toml`. Database migration application remains
an explicit operation; do not treat typechecks or Worker builds as migration
application.

## Public portfolio MCP — remote Streamable HTTP

The public, read-only portfolio MCP is isolated in `workers/portfolio-mcp/`.
It is a remote stateless Cloudflare Worker using Streamable HTTP at
`https://mcp.syn-forge.com/mcp`; it is not the local stdio repository MCP.
Check and test it with:

```bash
npm run mcp:portfolio:check
npm run test:portfolio-mcp
npm run mcp:portfolio:dev
```

The production deployment wrapper is `npm run mcp:portfolio:deploy`; it
delegates to the workspace's `wrangler.toml`. Deployment and custom-domain
activation are separate from local checks. See
[[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]] for its Service Binding and
post-deploy verification contract. See
[[architecture/portfolio-mcp-modules|Public Portfolio MCP module structure]] when changing its
internal Worker modules.

## Local repository MCP — stdio

The local repository-only MCP is the `tools/repository-mcp/` workspace. It is a
stdio subprocess with no public URL. Its root-safe client bridge remains
`scripts/mcp-launcher.mjs` so `.mcp.json` and Codex can resolve a relocated Git
checkout.

Use [[operations/repository-mcp|Local Repository MCP (stdio) and Commit Pipeline]]
for the guarded change and commit workflow. The local checks for repository
tooling are:

```bash
npm run mcp:check
npm run skills:check
npm run mcp:typecheck
npm run test:mcp
npm run setup:git-hooks
```

This MCP is local-only. It does not expose the public portfolio contract, deploy,
access Cloudflare credentials, or apply D1 migrations. Graphify updates remain
an explicit separate step.

## Graphify

Graphify is managed by Pipenv and keeps generated state under
`graphify-out/`:

```bash
pipenv install --dev --deploy
pipenv run graphify query "How does the frontend connect to the Hono API?"
pipenv run graphify update . --no-cluster
```

The repository Graphify configuration is code-only. Use the vault map for
Markdown documentation rather than expecting the code graph to contain notes.

## D1 workflow

Use [[database/drizzle|Drizzle tooling]] and [[database/migrations|the migration guide]] for schema changes. The editable schema and migrations are owned by
`workers/portfolio-api/`:

```bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
npm run db:migrations:apply:local
```

Inspect SQL and verify the local schema before considering a remote apply.
Existing seed content is not migration history.

Do not put secrets in committed environment files. The frontend preserves the
root `.env` location for local Vite variables through its configured `envDir`;
workspace-specific deployment settings remain in their Wrangler files.
