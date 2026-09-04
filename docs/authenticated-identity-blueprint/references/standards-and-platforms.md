---
title: Authenticated Identity Blueprint Standards and Platform References
aliases:
  - Identity security references
  - Realtime gateway bibliography
tags:
  - blueprint
  - references
  - security
role: reference
status: verified-external
last_verified: 2026-09-04
related:
  - "[[authenticated-identity-blueprint|Blueprint index]]"
  - "[[authenticated-identity-blueprint/01-vocabulary-and-trust-boundaries|Trust boundaries]]"
---

# Standards and Platform References

These are short pointers for verification and refresh. They are not copied
manuals. Recheck a source when its platform, SDK, compatibility date, or
security guidance changes.

| Source | Use in this blueprint | Refresh trigger |
| --- | --- | --- |
| [RFC 9700 — OAuth 2.0 Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html) | authorization-code, PKCE, transaction binding, and modern OAuth threat guidance | OAuth provider or client-flow change |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | opaque session identifiers, cookie protections, storage avoidance, and revocation | session/cookie policy change |
| [OWASP Information Exposure Through Query Strings](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url) | why bearer values in URLs remain exposed despite HTTPS | URL, telemetry, or credential-placement change |
| [Cloudflare Agents class lifecycle](https://developers.cloudflare.com/agents/runtime/lifecycle/agent-class/) | `onStart`, `onConnect`, static hibernation options, and lifecycle scope | Agents SDK upgrade |
| [Cloudflare Agents WebSockets](https://developers.cloudflare.com/agents/runtime/communication/websockets/) | server-side connection lifecycle and hibernation behavior | Agents SDK or WebSocket behavior change |
| [Cloudflare Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) | hibernatable server connections and persistence requirements | Workers runtime or compatibility-date change |
| [Cloudflare Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) | restart, eviction, and in-memory-state caveats | Workers runtime change |
| [Cloudflare service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) | private Worker-to-Worker forwarding and deployment order | binding topology or deployment workflow change |

The universal notes remain framework-neutral even when this bibliography contains
platform-specific references. Record the chosen adapter’s versions and evidence
in its adapter note and ledger, not in the universal contracts.
