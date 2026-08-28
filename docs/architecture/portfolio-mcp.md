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
note documents the MCP adapter rather than duplicating that route list. The
portfolio API applies its own public projections before the MCP adapter sees the
data: `/api/settings` uses a fixed public setting allowlist, and public snippet
list/detail responses omit storage paths and ordering metadata. The MCP
projection remains a second boundary.

Markdown snippets are available through bounded chunks. PDF snippets return
metadata and canonical links rather than attempting to extract document text.
Upstream calls have an eight-second timeout and text responses have a one MiB
cap before MCP's per-response chunk limit is applied.

## Cache behavior

The MCP Worker caches successful public `portfolio-api` GET responses for
six hours (21,600 seconds) through Cloudflare's Cache API. The cache key is an
internal synthetic GET URL containing the upstream API origin, path, and query,
so paginated reads stay distinct without caching the MCP endpoint's POST
requests. Host and Origin validation, MCP protocol handling, and tool/resource
result formatting therefore run for every public MCP request.

The API defaults its responses to `no-store`; the MCP cache stores a cloned
response with a six-hour shared-cache TTL only after JSON decoding or bounded
text validation succeeds. Cache writes run through the Worker's
`ExecutionContext.waitUntil()` and failures are treated as cache misses, not
public MCP failures. Upstream errors, invalid JSON, oversized text, and
responses that set cookies are never cached.

Cloudflare Cache API entries are local to the data center that fills them and
are not globally replicated or tiered. A portfolio update can remain visible
through MCP for up to six hours in a previously warmed location. There is no
KV binding or explicit purge workflow for this read-only cache.

## Output contracts

The installed `@modelcontextprotocol/server` 2.0.0 API supports native `outputSchema` declarations and `structuredContent`. Every successful tool call now advertises a strict Zod 4 output schema, returns the same value in `structuredContent`, and retains a readable JSON text block for clients that have not adopted structured results.

The schemas are strict and discriminated where a tool has more than one success shape:

- Overview returns `site`, `profile`, and `sections` with only the documented public fields.
- Project and certificate collections return `data` plus bounded `pagination`; detail tools return the record, media, and collection `canonical_url`.
- Search returns the trimmed `query` and discriminated profile, project, certificate, or snippet results without internal ranking scores.
- Snippet listing returns public metadata only. Markdown reads return a bounded chunk with offsets; PDF reads return metadata and canonical links with `content_available: false`.

The adapter reconstructs settings, profile, section, project, certificate, media, and snippet objects from explicit field allowlists before they reach a tool result. Database identifiers remain only where they are needed to retrieve or relate public records; storage paths, unknown upstream fields, and presentation-only fields from profile or section-item rows are omitted.

The current D1 schema has no draft or visibility column. Records returned by the existing public API routes are therefore treated as published portfolio records; introducing non-public records would require a separate publication boundary in the API.

Data-adapter failures return `isError: true` with a stable `{ code, message }` envelope using `INVALID_INPUT`, `NOT_FOUND`, `RATE_LIMITED`, or `INTERNAL_ERROR`. Upstream bodies, exception messages, stack traces, SQL, and infrastructure details are not returned. Input-shape failures remain SDK protocol-level validation errors.

`outputSchema` and `structuredContent` apply to tool calls. The four stable
portfolio resources remain resource handlers with JSON MIME text contents; they
do not advertise tool output schemas.

## Tools

The server is intentionally read-only. It exposes no create, update, delete, upload, execution, administration, raw SQL, arbitrary filesystem, or arbitrary database operation. Its portfolio transport only issues fixed `GET` requests to the existing public API routes; authenticated API write routes are not part of the client.

| Tool | Inputs | Success output |
| --- | --- | --- |
| `get_portfolio_overview` | None | `{ site, profile, sections }` with public identity, capabilities, home content, and links |
| `search_portfolio` | `query` (1–200 characters), optional `limit` (1–20) | `{ query, results[] }`; each result has a documented `kind` and public evidence fields |
| `list_projects` | Optional `limit` (1–12) and cursor (1–512 characters) | `{ data: project[], pagination }` |
| `get_project` | Positive safe integer `id` | `{ project, gallery, canonical_url }` |
| `list_certificates` | Optional `limit` (1–12) and cursor (1–512 characters) | `{ data: certificate[], pagination }` |
| `get_certificate` | Positive safe integer `id` | `{ certificate, items, canonical_url }` |
| `list_snippets` | None | `{ snippets[] }` with public Markdown/PDF metadata and canonical links |
| `read_snippet` | Positive safe integer `id`, optional `offset` (0–1,048,576) and `max_chars` (1–32,000) | A strict Markdown chunk shape or a strict PDF metadata/link shape |

The output schemas are advertised in `tools/list` and validated by the MCP SDK before successful results are returned.

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

## References

The transport terminology follows [Cloudflare's remote MCP guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/)
and the [MCP transport specification](https://modelcontextprotocol.io/specification/draft/basic/transports).
