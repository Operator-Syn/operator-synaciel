---
title: Stage 4 — Rate-Limit Resilience
aliases: [Portfolio MCP GitHub quota resilience]
tags: [plan, mcp, github, cloudflare]
role: project-plan-stage
status: planned
plan_id: portfolio-mcp-github-app-rate-limit-hardening
stage: 4
milestone: M4
owner: Operator-Syn
risk: high
depends_on: [stage-3-authenticated-transport]
---

# Stage 4 — Rate-Limit Resilience

## Objective

Reduce avoidable GitHub calls, prevent retry storms, and constrain one abusive client without claiming that a public unauthenticated MCP has true per-user isolation.

## Quota model

- Installation tokens have a primary REST limit of at least 5,000 requests/hour per installation, with documented scaling/caps depending on installation target.
- All MCP users of one installation share that installation bucket.
- GitHub may apply secondary limits even while primary quota remains.
- Authentication removes dependence on the unauthenticated originating-IP bucket; it does not make quota infinite or user-specific.

## Cache stream

Retain the existing synthetic namespace and successful-response-only policy:

| Response | TTL |
| --- | ---: |
| Repository metadata | 21,600 seconds |
| README | 3,600 seconds |
| Commit list | 300 seconds |
| Main branch/reachability | 300 seconds |
| Full commit detail | 86,400 seconds |

Cache keys must include the complete fixed pathname and query. Cache hits must not call GitHub. Failed, malformed, oversized, or cookie-bearing responses remain non-cacheable.

## Failure handling

- Preserve GitHub `429` mapping to internal status `429`.
- Map `403` to rate-limited only with `x-ratelimit-remaining: 0` or `Retry-After`; ordinary authorization `403` remains an internal failure.
- Return the stable MCP `RATE_LIMITED` result without upstream bodies.
- Record only safe telemetry: endpoint class, status class, cache hit/miss, and retry-metadata presence.

## Backoff

- Do not replay a failed MCP tool call more than once inside the Worker.
- Treat `Retry-After` as the minimum delay for operator-controlled retry.
- When only `x-ratelimit-reset` exists, calculate UTC wait and cap any operator-facing suggestion.
- For secondary limits without usable headers, require at least a one-minute client/operator pause.
- Never queue or fan out retries from the Worker.

## Edge safeguard

Configure a Cloudflare edge rule for `mcp.syn-forge.com` limiting `POST /mcp` by client IP. Initial policy target: **60 requests per five-minute rolling window per IP**, returning `429` with a one-minute retry signal; review against legitimate traffic before enablement. This is a coarse abuse control and cannot isolate users behind shared NAT/proxies.

Keep the edge rule as a separate Cloudflare approval/evidence boundary unless an authorized IaC workflow is introduced.

## Tests

- Cache hit/miss tests prove only misses consume upstream calls.
- Primary-limit `403`, `429`, secondary-limit `403` with `Retry-After`, ordinary `403`, and missing-header cases map correctly.
- Backoff tests prove no retry loop or refresh storm.
- Edge policy records method, path, key, threshold, response, and owner.
- Use only bounded sequential smoke traffic; no load or high-volume testing.

## Exit gate — M4

Mark `verified` only when cache, error mapping, bounded backoff, and the separately configured edge safeguard are reviewed, with shared-installation limitations recorded.

## References

- [[plans/portfolio-mcp-github-app/references|Plan references]]
- [GitHub REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub App rate limits](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/rate-limits-for-github-apps)
- [[architecture/portfolio-mcp|Current cache and error contract]]
