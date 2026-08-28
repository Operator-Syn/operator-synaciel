---
title: Public Portfolio MCP (Streamable HTTP)
tags:
  - architecture
  - mcp
role: reference
---

# Public Portfolio MCP (Streamable HTTP)

> Scope: this note documents the public portfolio MCP only. It is a remote,
> read-only service for published portfolio information. It is not the local
> repository-only MCP; see [[operations/repository-mcp|Local Repository MCP (stdio) and Commit Pipeline]].

The public portfolio MCP is a separate stateless Cloudflare Worker workspace
under `workers/portfolio-mcp/`. It serves the MCP protocol over Streamable HTTP
at `https://mcp.syn-forge.com/mcp`.

The Worker uses the stateless `createMcpHandler` path. The SDK may accept
stateless legacy-compatible requests, but this deployment is not a sessionful
`McpAgent`/Durable Object server and it does not use stdio.

## Classification

| Property | Public portfolio MCP | Local repository MCP |
| --- | --- | --- |
| Transport | Streamable HTTP over HTTPS | stdio subprocess |
| Workspace | `workers/portfolio-mcp/` | `tools/repository-mcp/` |
| Authority | Published portfolio reads through `portfolio-api` | The checked-out Git repository |
| Mutability | Read-only; no portfolio writes | Guarded local changes, verification, and commits |
| Registration | Client URL: `https://mcp.syn-forge.com/mcp` | Project-scoped `.mcp.json` and `.codex/config.toml` |
| Deployment | Cloudflare Worker and `mcp.syn-forge.com` | No public deployment or HTTP endpoint |

## Boundary

The Worker uses a Service Binding to the existing `portfolio-api` Worker. The
adapter in `workers/portfolio-mcp/src/portfolio-api/` allowlists public GET
routes for the overview, projects, certificates, and snippets. It does not
access D1 or R2 directly, and it never exposes the API's authenticated write
routes. Its internal module seams are recorded in
[[architecture/portfolio-mcp-modules|Public Portfolio MCP module structure]].
The public GET route catalog is maintained in [[api/routes|API Routes]]; this
note documents the MCP adapter rather than duplicating that route list.

Markdown snippets are available through bounded chunks. PDF snippets return
metadata and canonical links rather than attempting to extract document text.
Upstream calls have an eight-second timeout and text responses have a one MiB
cap before MCP's per-response chunk limit is applied.

## Tools

The server is intentionally read-only. Every tool returns JSON content and reads
only the public portfolio contract:

| Tool | Inputs | Contract |
| --- | --- | --- |
| `get_portfolio_overview` | None | Public identity, capabilities, home content, and links |
| `search_portfolio` | `query` (1–200 characters), optional `limit` (1–20) | Bounded search across public profile, project, certificate, and snippet metadata |
| `list_projects` | Optional `limit` (1–12) and cursor | Public project records with cursor pagination and links |
| `get_project` | Positive numeric `id` | One public project record and gallery media |
| `list_certificates` | Optional `limit` (1–12) and cursor | Public certificate and training records with cursor pagination |
| `get_certificate` | Positive numeric `id` | One public certificate record and media items |
| `list_snippets` | None | Public Markdown and PDF metadata without file contents |
| `read_snippet` | Positive numeric `id`, optional `offset` and `max_chars` (1–32,000) | Bounded Markdown chunks, or PDF metadata and canonical links |

## Resources

The stable resources are `portfolio://overview`, `portfolio://projects`,
`portfolio://certificates`, and `portfolio://snippets`. They expose public JSON
records and canonical links without cursor pagination. Project and certificate
list tools cap each requested page at 12 records, search returns at most 20
results, and a Markdown response chunk is capped at 32,000 characters.

## Discovery

`/ai` is the human-facing connection guide. `apps/portfolio-web/public/llms.txt`
is a concise machine-readable context file containing the endpoint, transport,
contract boundary, and canonical portfolio links. It is excluded from the Pages
middleware so the deployed static asset remains `text/plain` instead of
receiving the SPA fallback. These surfaces improve discoverability but do not
claim that arbitrary agents automatically discover or register the server.

An MCP-capable client can register the endpoint with this configuration:

```json
{
  "mcpServers": {
    "syn-forge-portfolio": {
      "url": "https://mcp.syn-forge.com/mcp"
    }
  }
}
```

The MCP handler validates custom-domain Host and browser Origin allowlists. The
server is public and unauthenticated in this current surface, so deployment
monitoring and edge rate limiting remain operational responsibilities.

The public endpoint is not registered in this repository's `.mcp.json` or
`.codex/config.toml`; those files launch local project tooling. A user or agent
client registers the public URL directly.

## Local workflow

Run the Worker typecheck and protocol tests from the repository root with:

```bash
npm run mcp:portfolio:check
npm run test:portfolio-mcp
```

The equivalent workspace-local commands are:

```bash
npm run check --workspace=@syn-forge/portfolio-mcp
npm run test --workspace=@syn-forge/portfolio-mcp
```

Start the separate Worker locally with `npm run mcp:portfolio:dev`. The
production command is `npm run mcp:portfolio:deploy`; both root commands
delegate to the `workers/portfolio-mcp/` workspace. Deployment and custom
domain activation are intentionally separate from source verification.

The local environment uses the public API hostname as a fallback when the
Service Binding is not connected. Production uses the `PORTFOLIO_API` Service
Binding declared in `workers/portfolio-mcp/wrangler.toml`.

## Deployment

Before deploying, confirm all of the following:

1. Wrangler is authenticated to the Cloudflare account that owns the
   `syn-forge.com` zone: `npx wrangler whoami`.
2. The `portfolio-api` Worker already exists in that same account. Service
   binding targets must exist before this Worker is deployed.
3. `syn-forge.com` is an active Cloudflare zone and
   `mcp.syn-forge.com` does not have a conflicting existing CNAME.

Run the checked-in validation and dry run:

```bash
npm run mcp:portfolio:check
npm run test:portfolio-mcp
npm run typecheck
npm run build
npx wrangler deploy --dry-run --env="" \
  --config workers/portfolio-mcp/wrangler.toml
```

Authenticate interactively if needed, then deploy the top-level production
configuration:

```bash
npx wrangler login
npm run mcp:portfolio:deploy
```

The `--env=""` in the deployment script is deliberate: the config contains
an `env.local` environment for development, while production uses the
top-level Worker name, Service Binding, and Custom Domain. The
`custom_domain = true` route lets Cloudflare create the DNS record and
certificate for `mcp.syn-forge.com` when the zone and hostname are eligible.

After deployment, register the endpoint in an MCP client and confirm that
`tools/list`, `resources/list`, and `get_portfolio_overview` succeed. Check
the public discovery surfaces at [`/ai`](https://syn-forge.com/ai) and
[`/llms.txt`](https://syn-forge.com/llms.txt). Use the Cloudflare dashboard or
`npx wrangler tail syn-forge-portfolio-mcp` to inspect runtime errors and
latency; do not log portfolio document contents.

The frontend Pages deployment remains separate from this Worker deployment.
`npm run deploy` is the legacy `gh-pages` command and does not deploy the
MCP Worker.

## References

The transport terminology follows [Cloudflare's remote MCP guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/)
and the [MCP transport specification](https://modelcontextprotocol.io/specification/draft/basic/transports).
