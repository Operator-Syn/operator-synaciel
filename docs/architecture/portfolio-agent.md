---
title: Portfolio Assistant Agent
aliases:
  - Portfolio agent
  - Public portfolio assistant
tags:
  - architecture
  - agents
  - cloudflare
role: reference
---

# Portfolio Assistant Agent

The public assistant is a browser-only, site-wide floating assistant for
questions about the Syn-Forge portfolio. It is split into two Worker
workspaces:

- `workers/portfolio-public-auth/` owns Google OIDC sign-in, Turnstile
  verification, sessions, thread ownership, quotas, admin controls, and
  short-lived WebSocket access tokens.
- `workers/portfolio-agent/` owns the stateful `AIChatAgent` Durable Object,
  Workers AI calls, MCP tool selection, compaction, and sanitized thread export
  and deletion.

The frontend mounts
[`PortfolioAssistantFab`](../../apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx)
from the global application shell. It connects to
the configured `VITE_PORTFOLIO_AGENT_URL` only after the public-auth Worker has
issued a one-time scoped token. Production has an explicit assistant origin;
development requires a local endpoint override and never falls back to
production. The frontend disables query caching for this token so closing and
reopening the FAB cannot reuse a consumed credential. The token is passed in
the WebSocket query because a browser WebSocket cannot set a custom
Authorization header.

## Grounding and scope

The agent connects only to the existing public, read-only Portfolio MCP at
`https://mcp.syn-forge.com/mcp`. Every accepted user message first calls
`search_portfolio`. If that preflight has no usable evidence, the agent
returns a bounded refusal without invoking Workers AI. The model receives
portfolio evidence as untrusted data and is instructed to cite canonical
portfolio or explicitly requested linked-repository URLs.

GitHub tools stay hidden unless the user explicitly asks for repository,
README, commit, or source context. The assistant never executes code, changes
accounts, writes portfolio data, or performs unrelated general-purpose work.
The public MCP itself remains independently public; this assistant is one
authenticated consumer of it.

## Hard limits and compaction

The agent enforces both limits in
[`limits.ts`](../../workers/portfolio-agent/src/limits.ts) and
[`agent.ts`](../../workers/portfolio-agent/src/agent.ts):

- At most **10 model passes per accepted user message**.
- At most **20 MCP tool calls per accepted user message, including the
  `search_portfolio` preflight**.

The MCP wrapper fails closed when the 20-call budget is exhausted, and the AI
SDK stop condition ends the model loop at 10 passes. Retries are disabled for
the model call. These are per-turn hard caps, separate from the five-turn
ten-minute thread burst limit and the 20-turn UTC-day account quota.

The Durable Object persists at most 200 messages. Before a model call, context
is compacted when it exceeds 20 user turns or an estimated 8,000 input tokens;
the latest six messages are retained and a visible `data-compaction` event
explains that a new thread is available. Exports include text, compaction
summaries, citations, and available timestamps, never raw MCP payloads or tool
arguments. Threads are retained for 30 days unless the user deletes them.

## Capacity and controls

Workers AI uses `@cf/zai-org/glm-4.7-flash`. The account-wide estimate is
bounded at 8,000 neurons per day (an automatic pause at 80% of the 10,000
free-allocation reference). The estimate resets at the next UTC day; a
manual admin reset or pause control is also available in public-auth. The
implementation records aggregate quota counters only; user identity is not
sent to the model and Google access tokens are not stored.

Local source and checks establish the implementation only. D1 creation,
migration application, runtime-key provisioning, Worker deployment, and live
smoke checks remain separate approval-gated operations. See
[[architecture/portfolio-public-auth|Public portfolio authentication]] and
[[operations/deployment|Production deployment]] for those boundaries.

## References

- [Agent Worker configuration](../../workers/portfolio-agent/wrangler.toml)
- [Agent implementation](../../workers/portfolio-agent/src/agent.ts)
- [Agent limits](../../workers/portfolio-agent/src/limits.ts)
- [Public MCP architecture](./portfolio-mcp.md)
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)
- [Workers AI pricing and limits](https://developers.cloudflare.com/workers-ai/platform/pricing/)
