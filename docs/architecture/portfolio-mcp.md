---
title: Portfolio MCP
tags:
  - architecture
  - mcp
role: reference
---

# Portfolio MCP

The public portfolio MCP is a separate stateless Cloudflare Worker under
`workers/portfolio-mcp/`. Its intended endpoint is
`https://mcp.syn-forge.com/mcp`.

## Boundary

The Worker uses a Service Binding to the existing `portfolio-api` Worker. The
adapter in `workers/portfolio-mcp/src/portfolioApi.ts` allowlists public GET
routes for the overview, projects, certificates, and snippets. It does not
access D1 or R2 directly, and it never exposes the API's authenticated write
routes.

Markdown snippets are available through bounded chunks. PDF snippets return
metadata and canonical links rather than attempting to extract document text.
Upstream calls have an eight-second timeout and text responses have a one MiB
cap before MCP's per-response chunk limit is applied.

## Contract

The server is intentionally read-only. Its tools are:

- `get_portfolio_overview` - public identity, capabilities, home content, and
  links.
- `search_portfolio` - bounded search across profile, project, certificate,
  and snippet metadata.
- `list_projects` and `get_project` - project records, pagination, and gallery
  media.
- `list_certificates` and `get_certificate` - certificate records, pagination,
  and media items.
- `list_snippets` - public Markdown and PDF metadata.
- `read_snippet` - Markdown content in chunks, or PDF metadata and canonical
  links.

The stable resources are `portfolio://overview`, `portfolio://projects`,
`portfolio://certificates`, and `portfolio://snippets`. List calls cap each
page at 12 records, search returns at most 20 results, and a Markdown response
chunk is capped at 32,000 characters.

## Discovery

`/ai` is the human-facing connection guide. `public/llms.txt` is a concise
machine-readable context file containing the endpoint, contract boundary, and
canonical portfolio links. It is excluded from the Pages middleware so the
deployed static asset remains `text/plain` instead of receiving the SPA
fallback. These surfaces improve discoverability but do not claim that
arbitrary agents automatically discover or register the server.

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
server is public and unauthenticated in this first version, so deployment
monitoring and edge rate limiting remain operational responsibilities.

## Local workflow

Run the Worker typecheck and protocol tests with:

```bash
npm run mcp:portfolio:check
npm run test:portfolio-mcp
```

Start the separate Worker locally with `npm run mcp:portfolio:dev`. The
production command is `npm run mcp:portfolio:deploy`; deployment and custom
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
