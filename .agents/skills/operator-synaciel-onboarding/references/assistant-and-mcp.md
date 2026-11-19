# Public MCP, public auth, and the portfolio assistant

This note extends [the repository map](repository-map.md) for three owners whose
runtimes are easy to confuse. The map stays the doorway; use this page after one
of its routes stops being specific enough. Each table row starts from a symptom,
names the authoritative note, then traces the contract through the exact
producer and consumer files to an owning check. What a check proves is local
implementation behavior, not production state. Orientation here does not
authorize installing, starting services, deploying, applying migrations, or
using credentials; those remain separate actions described in
[Local Development](../../../../docs/operations/local-development.md) and
[Production deployment](../../../../docs/operations/deployment.md).

The split matters before reading any row. The public portfolio MCP
(`workers/portfolio-mcp/`) is a separate, stateless Streamable HTTP Worker with
no account, session, cookie, or Durable Object; it reads published data through
the portfolio API. Public authentication (`workers/portfolio-public-auth/`) owns
Google sign-in, the session cookie, thread ownership, quota views, and the
browser-facing WebSocket gateway. The portfolio assistant
(`workers/portfolio-agent/`) owns the private Durable Object, model calls, MCP
client connection, and evidence. The browser never talks to the assistant
Worker directly: public-auth rechecks the cookie, ownership, and Turnstile state,
then forwards the upgrade over its `AGENT_WORKER` service binding. The assistant
is a separate MCP client of the public MCP, not the MCP transport itself.

## Public Portfolio MCP

Authoritative notes: [Public Portfolio MCP](../../../../docs/architecture/portfolio-mcp.md)
and [module structure](../../../../docs/architecture/portfolio-mcp-modules.md).
Tool names, limits, resources, and cache policy are documented there; do not
restate them here.

| Task | Start here | Trace and verify |
| --- | --- | --- |
| A client cannot reach the endpoint, or a request is rejected by host or browser origin | The MCP note's transport and discovery sections; `workers/portfolio-mcp/src/config.ts` for endpoint path and hostname allowlists | Contract: stateless Streamable HTTP at route /mcp with host and Origin allowlists. Producer `workers/portfolio-mcp/src/worker.ts`; consumer `workers/portfolio-mcp/src/mcp/handler.ts` passes route and allowlists into the MCP handler. Test `workers/portfolio-mcp/tests/protocol.test.ts` includes an untrusted-origin rejection. Limit: an in-process handler over a fake API binding; DNS, TLS, custom-domain activation, and edge rate rules are not exercised. |
| The tool list, an input bound, or a structured result differs from the note | The MCP note's output contracts and tools tables; `workers/portfolio-mcp/src/mcp/schemas.ts` | Contract: every successful tool advertises a strict output schema, returns the same value as structured content, and keeps a JSON text block. Producer `workers/portfolio-mcp/src/mcp/server.ts` and `workers/portfolio-mcp/src/mcp/tools/index.ts`; consumers `workers/portfolio-mcp/src/mcp/schemas.ts` and `workers/portfolio-mcp/src/mcp/results.ts`. Test `workers/portfolio-mcp/tests/protocol.test.ts` covers advertised schemas and sanitized errors. Limit: schema validity is checked in-process; no external client SDK version is exercised. |
| Portfolio reads return empty, over-broad, or internally-shaped data | The MCP note's boundary and output contracts; `workers/portfolio-mcp/src/portfolio-api/client.ts` | The client selects specific public GET paths and projects upstream records; `workers/portfolio-mcp/src/portfolio-api/transport.ts` sends GETs but is not a separate route allowlist. For a response change, compare the owning route in `workers/portfolio-api/src/entrypoint.ts` and the consumer in `workers/portfolio-mcp/src/mcp/tools/`. Start with the public API binding and overview allowlisting case in `workers/portfolio-mcp/tests/protocol.test.ts`. It uses a fake upstream; it does not prove D1/R2 publication or the API's own projection. |
| A project GitHub tool reports a repository as missing, denied, or stale | The MCP note's GitHub boundary; `workers/portfolio-mcp/src/github/` | Contract: strict owner/repository link, fixed main branch, fresh visibility check per call, bounded reads, no writes or patches. Producer `workers/portfolio-mcp/src/github/`; consumer `workers/portfolio-mcp/src/mcp/tools/github.ts`. Tests `workers/portfolio-mcp/tests/github.test.ts` and `workers/portfolio-mcp/tests/github-auth.test.ts` cover private-repository rejection, non-main refs, and token narrowing. Limit: stubbed GitHub fetch; App installation scope, secret values, live rate limits, and installation-token exchange are not verified. |
| Cached data looks stale after a portfolio update | The MCP note's cache behavior; `workers/portfolio-mcp/src/portfolio-api/transport.ts` | Contract: successful public GETs are cached per origin/path/query for six hours, GitHub entries use separate immutable-keyed namespaces, and a cache failure is a miss. Producer `workers/portfolio-mcp/src/portfolio-api/transport.ts`; consumer wiring `workers/portfolio-mcp/src/worker.ts` supplies the Cache API and waitUntil. Test `workers/portfolio-mcp/tests/protocol.test.ts` covers cache keys and failure-as-miss behavior. Limit: the Cache API is faked; per-data-center warming and six-hour staleness cannot be reproduced locally. |

## Public authentication

Authoritative note: [Public Portfolio Authentication](../../../../docs/architecture/portfolio-public-auth.md).
The browser flow, cookie attributes, key fragments, and admin routes are
documented there; this section only routes code and checks.

| Task | Start here | Trace and verify |
| --- | --- | --- |
| Sign-in fails, loops, or the callback rejects the Google response | The auth note's browser flow; `workers/portfolio-public-auth/src/index.ts` OAuth start and callback routes | Follow the callback's state lookup, token exchange, and session creation through `workers/portfolio-public-auth/src/crypto.ts` and `workers/portfolio-public-auth/src/config.ts`. Start with the return-target case in `workers/portfolio-public-auth/tests/security.test.ts` for redirect issues and `workers/portfolio-public-auth/tests/session.test.ts` for a session missing after sign-in. Those checks cover helpers and the session endpoint; neither runs the OAuth callback or token exchange. |
| The browser shows signed out when a session should exist | The auth note's session and cookie sections; `workers/portfolio-public-auth/src/index.ts` session route | Contract: a missing or invalid cookie returns 401 with an unauthenticated body; coded failures stay errors. Producer `workers/portfolio-public-auth/src/index.ts`; consumer `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts`. Tests `workers/portfolio-public-auth/tests/session.test.ts` and `apps/portfolio-web/tests/portfolio-assistant-history.test.ts`. Limit: cookie attributes and cross-site SameSite behavior are asserted in code, not in a real browser; only the gated Playwright suite observes them. |
| The assistant connection cannot be prepared or upgraded | The auth note's gateway steps; `workers/portfolio-public-auth/src/index.ts` prepare and agent upgrade routes | Contract: prepare returns only an opaque attempt ID; the upgrade rechecks session, Turnstile, pause, and ownership, strips browser credentials, and forwards a trusted identity over the agent service binding. Producer `workers/portfolio-public-auth/src/index.ts` plus `workers/portfolio-public-auth/wrangler.toml`; consumer `workers/portfolio-agent/src/index.ts`. Tests `workers/portfolio-public-auth/tests/agent-gateway.test.ts` and `workers/portfolio-agent/tests/internal-websocket.test.ts`. Limit: the service binding and upgrade are simulated; no real WebSocket handshake or Cloudflare routing is exercised. |
| Thread lists, history pages, export, or delete return the wrong status | The auth note's hydration and thread guard sections; `workers/portfolio-public-auth/src/index.ts` threads routes | Contract: history is read-only and ownership-checked; pagination uses an opaque message-ID cursor; export and delete forward over the private service binding. Producer `workers/portfolio-public-auth/src/index.ts`; consumer `workers/portfolio-agent/src/index.ts` internal thread routes. Tests `workers/portfolio-public-auth/tests/thread-messages.test.ts` and `apps/portfolio-web/tests/portfolio-assistant-history.test.ts`. Limit: fake D1 ownership rows and fake agent payloads; Durable Object SQLite is not the real store here. |
| The quota meter disagrees with a turn decision | The auth note's quota section; `workers/portfolio-public-auth/src/index.ts` quota route | Contract: the route returns only the calling subject's weighted rolling usage and reset time. Producer `workers/portfolio-public-auth/src/index.ts`; consumer `workers/portfolio-public-auth/src/config.ts` budget constants and `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts`. Test `workers/portfolio-public-auth/tests/quota.test.ts`. Limit: seeded reservations; no provider usage dashboard or concurrent production turns. |

## Portfolio assistant

Authoritative note: [Portfolio Assistant Agent](../../../../docs/architecture/portfolio-agent.md).
The evidence gate, quota weighting, page reader, and recovery policy live there;
read it before changing behavior behind any row below.

| Task | Start here | Trace and verify |
| --- | --- | --- |
| An answer is refused as unverified, or makes claims with no usable source | The agent note's grounding, evidence, and same-origin page sections; `workers/portfolio-agent/src/evidence.ts` | Contract: text before usable evidence is suppressed, three unusable results end the turn, and fresh ledger entries expire after 30 minutes. Producer `workers/portfolio-agent/src/agent.ts`; consumers `workers/portfolio-agent/src/portfolio-guide.ts` and `workers/portfolio-agent/src/evidence.ts`. Tests `workers/portfolio-agent/tests/model-tool-loop.test.ts`, `workers/portfolio-agent/tests/evidence.test.ts`, and `workers/portfolio-agent/tests/context-reliability.test.ts`. Limit: the model is stubbed; answer quality and real provider behavior are not asserted. |
| The MCP catalog is empty, tools are missing, or reconnects loop | The agent note's grounding and WebSocket recovery sections; `workers/portfolio-agent/src/mcp.ts` | Contract: MCP connects lazily, discovery gets one bounded 60-second budget, three total add attempts, and a failed catalog degrades the turn instead of the socket. Producer `workers/portfolio-agent/src/config.ts` supplies the endpoint and bounds; consumer `workers/portfolio-agent/src/agent.ts` owns the manager. Tests `workers/portfolio-agent/tests/lifecycle.test.ts` and `workers/portfolio-agent/tests/natural-routing.test.ts`. Limit: a fake MCP manager; natural-routing asserts source shape rather than tool choice, and the live public MCP is not contacted. |
| A turn is rejected by quota, or reserved usage never settles | The agent note's capacity and controls; `workers/portfolio-agent/src/quota.ts` | Contract: a cheap availability peek precedes catalog work, the post-conversion reservation is authoritative, and settlement uses provider usage. Producer `workers/portfolio-agent/src/quota.ts`; consumer `workers/portfolio-agent/src/agent.ts`. Tests `workers/portfolio-agent/tests/quota.test.ts` and `workers/portfolio-agent/tests/limits.test.ts`. Limit: fake D1 and synthetic provider usage; the Workers AI dashboard remains authoritative. |
| Streaming fails, reasoning leaks, or a thread title never settles | The agent note's stream and title sections; `workers/portfolio-agent/src/stream.ts` | Contract: reasoning stays behind a closed disclosure and is stripped from later input; titles are best-effort, bounded, and first-writer-wins. Producer `workers/portfolio-agent/src/stream.ts` and `workers/portfolio-agent/src/thread-title.ts`; consumer `workers/portfolio-agent/src/agent.ts`. Tests `workers/portfolio-agent/tests/stream.test.ts`, `workers/portfolio-agent/tests/thread-title.test.ts`, and `workers/portfolio-agent/tests/agent-stream-title.test.ts`. Limit: mocked model parts; no live Workers AI stream or UI rendering. |
| History, export, or delete behaves differently from the Durable Object transcript | The agent note's thread history and export sections; `workers/portfolio-agent/src/index.ts` internal thread routes | Contract: the Durable Object message store is the source of truth; export strips arguments, raw tool payloads, and credentials; history pagination is presentation-only. Producer `workers/portfolio-agent/src/index.ts`; consumer `workers/portfolio-agent/src/export.ts`. Tests `workers/portfolio-agent/tests/export.test.ts`, `workers/portfolio-agent/tests/thread-evidence.test.ts`, and `apps/portfolio-web/tests/portfolio-assistant-history.test.ts`. Limit: the Durable Object and its SQLite are simulated; retained 30-day data is not observed. |
| The browser cannot connect, reconnect, or load an active assistant locally | The local-development assistant sections; `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantAvailability.ts` | Check the live mode and resolved public-auth origin in `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts` before tracing prepare and retry behavior through `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts` and `apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx`. Start with `apps/portfolio-web/tests/portfolio-assistant-config.test.ts` for wiring or `apps/portfolio-web/tests/portfolio-assistant-history.test.ts` for persisted history. Local checks do not exercise a live handshake; `apps/portfolio-web/tests/google-authenticated.spec.ts` needs a saved session and an active-assistant build. |

## Downstream bindings and local limits

Public-auth reaches the assistant only through the `AGENT_WORKER` service
binding declared in `workers/portfolio-public-auth/wrangler.toml`; the agent
Worker exposes no MCP route. The agent's
`workers/portfolio-agent/wrangler.toml` pins `PORTFOLIO_MCP_URL` to the public
MCP even in its local profile, so a local assistant still depends on that
upstream. Independently, the public MCP's own local Wrangler profile sets a
production Portfolio API origin, and its adapter uses HTTP when no service
binding is supplied. Check that binding and origin before running a local
command under an offline or no-production constraint. The local public-auth
profile binds `portfolio-agent-local`, and `localhost:8788` is not a browser
endpoint. Vite's assistant client needs an explicit public-auth origin; it does
not provide a production fallback. None of these checks create D1 databases,
apply migrations, provision runtime keys, or prove a deployed release.
