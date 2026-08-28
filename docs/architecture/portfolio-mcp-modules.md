---
title: Public Portfolio MCP Module Structure
tags:
  - architecture
  - mcp
  - structure
role: reference
---

# Public Portfolio MCP Module Structure

> Scope: this note records the internal module convention for the public
> portfolio MCP. Its tools, resources, transport, and deployment contract are
> documented in [[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]].

The Worker keeps its Wrangler entrypoint and protocol assembly thin. Independent
responsibilities live behind small interfaces so a change to one concern stays
local and the public MCP contract remains easy to verify. Tool output schemas live in
`src/mcp/schemas.ts`; the result helper keeps structured content and a text
compatibility block in sync.

## Module map

| Path | Owns |
| --- | --- |
| `src/index.ts` | Wrangler entrypoint exports and the stable public import surface |
| `src/worker.ts` | Cloudflare `fetch` adaptation and handler type compatibility |
| `src/config.ts` | Server identity, limits, host/origin policy, and Worker environment type |
| `src/mcp/handler.ts` | Streamable HTTP handler construction and request policy |
| `src/mcp/server.ts` | `McpServer` construction and registration order |
| `src/mcp/resources.ts` | The four public JSON resources |
| `src/mcp/tools/` | Tool schemas and callbacks grouped by overview, search, projects, certificates, and snippets |
| `src/mcp/tools/github.ts` | Project-linked GitHub repository, README, and commit tool registration |
| `src/mcp/search.ts` | Bounded cross-domain search and ranking |
| `src/mcp/snippets.ts` | Public snippet metadata projection |
| `src/mcp/schemas.ts` | Strict Zod 4 output schemas for every public tool |
| `src/mcp/results.ts` | Structured JSON/text success results and sanitized error formatting |
| `src/mcp/links.ts` and `validation.ts` | Canonical collection URLs and input normalization |
| `src/portfolio-api/client.ts` | Portfolio API route composition, response aggregation, and explicit public projections |
| `src/portfolio-api/transport.ts` | GET requests, timeout, status, JSON/text decoding, and byte limits |
| `src/portfolio-api/types.ts` | The adapter's data and client contract types |
| `src/portfolio-api/snippets.ts` and `urls.ts` | Snippet-tree normalization and public URL helpers |
| `src/portfolio-api/index.ts` | Internal API adapter barrel |
| `src/portfolioApi.ts` | Compatibility barrel only; it contains no adapter implementation |
| `src/github/` | Strict project-link parsing, fixed-`main` GitHub REST reads, normalization, and cache transport |

## Convention

1. Keep `src/index.ts` and `src/worker.ts` focused on runtime wiring. Protocol
   registration and portfolio data behavior belong in `mcp/` and
   `portfolio-api/`.
2. Keep the MCP server dependent on the `PortfolioApiClient` interface. Tool
   and resource modules receive the server and client they need instead of
   constructing transport or request state themselves.
3. Keep one independently changeable concern behind each module interface:
   protocol policy, registration, search, snippet projection, API transport,
   endpoint composition, or data types.
4. Group related tools by portfolio domain and preserve their order in
   `mcp/tools/index.ts`; a new tool should have a focused registrar and a
   contract test when its behavior is not covered by the protocol suite.
5. Split by responsibility and locality, not by an arbitrary line-count
   threshold. A small registrar is acceptable when it isolates a coherent
   protocol surface; a large file is a refactor candidate when it owns more
   than one independently changing concern.
6. Preserve the public tool names, resource URIs, schemas, result shapes, host
   allowlists, and API route allowlist while moving implementation behind a new
   seam. Use a compatibility barrel when an existing local import path is
   useful, but keep only one implementation.

## Refactor checklist

For a public MCP structural change:

1. Query Graphify, then confirm the cited imports and callers in source.
2. Record the affected seam and its unchanged public contract in the focused
   module or contract note.
3. Move one responsibility at a time and run the portfolio MCP typecheck and
   protocol tests after each chunk.
4. Run `npm run test:mcp` so the public/local MCP documentation and module
   boundary guard remains aligned.
5. Run `pipenv run graphify update .` after code changes, then review the final
   diff and `git diff --check`.

Related runtime commands and deployment boundaries remain in
[[operations/local-development|Local Development]].
