---
title: Sweep 34 — Cross-record evidence grounding
aliases:
  - Portfolio Agent Sweep 34
tags:
  - plan
  - agents
  - mcp
  - grounding
  - verification
role: project-plan-sweep
status: complete
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-02
risk: high
---

# Sweep 34 — Cross-record evidence grounding

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]],
[[plans/portfolio-agent/README|the reliability plan]], or
[[plans/portfolio-agent/audit|the audit]]. The preceding diagnostics work is in
[[plans/portfolio-agent/sweeps/33-structured-diagnostics|Sweep 33]].

## Objective

Prevent a broad candidate search from becoming proof about a different portfolio
record. The source boundary must distinguish discovery candidates, hydrated
record evidence, and claims safe to render.

## Locked contract

- Keep broad search as the compatibility discovery mode, and add an additive
  `match_mode: "all"` precision mode.
- Return `matched_terms` and `matched_fields` provenance; record-kind words
  filter by kind rather than incidental description text.
- Build grounding queries from user messages only. Treat prior assistant prose
  as an untrusted draft, never as evidence.
- Use closed-world semantics: a complete retrieved record that lacks the
  requested attribute is **not stated**; a failed detail read is **could not
  verify**.
- Render precise attribute and record-filter answers deterministically. Buffer
  broad model output as a strict object with ledger references and exact quotes
  before emitting it.

## Superseding revision — 2026-09-03

The deterministic question classifier and strict answer-object path described
above were useful as an experiment but made ordinary conversation brittle. The
current implementation keeps the MCP search/overview evidence boundary and
user-only context, then gives the complete read-only tool catalog to one natural
model stream. The model now handles portfolio scope, follow-ups, and missing
evidence conversationally; this sweep remains the historical record of the
stricter experiment. [[plans/portfolio-agent/sweeps/35-conversational-evidence-grounding|Sweep 35]] is the
current routing contract.

## Implementation and evidence

- [x] Added normalized broad/all MCP search with additive output provenance,
      strict schemas, server version `1.1.0`, and compatibility fallback when an
      older server rejects `match_mode`.
- [x] Added the agent evidence ledger, bounded project/certificate detail
      hydration, technology-query classification, user-only bounded grounding
      context, and deterministic precise evidence blocks.
- [x] Added strict broad-answer validation for record-local quotes, internal
      reference suppression, and technology terms that are absent from their
      cited quotes. Linked GitHub repository, README, and commit metadata are
      preloaded before JSON-schema generation when explicitly requested.
- [x] Kept the Workers AI JSON-schema path buffered: structured generation runs
      only after detail hydration, and no unchecked model stream reaches the
      browser. Server-owned source URLs are emitted as opaque UI source parts.
- [x] Added regressions for Flask/BAI cross-record attribution, kind-aware
      search, punctuation normalization, incomplete detail reads, prior assistant
      exclusion, invalid references/quotes, ID leakage, MCP schema compatibility,
      and bounded GitHub preloading.

Local evidence: `npm run test:portfolio-agent` (50 passing),
`npm run test:portfolio-mcp` (19 passing), and both affected Worker
typechecks pass on 2026-09-02. Documentation checks and the full fixed
repository profile remain the final local gate.

## Acceptance and limitations

The exact Flask/BAI failure is fail-closed in the precise path: BAI records are
reported as **not stated** only after successful detail hydration, while a
failed detail read reports **could not verify**. Search remains useful for
exploration, but its candidates and provenance are not themselves user-facing
proof.

This sweep establishes current source and local-test behavior only. It does not
establish the deployed MCP/agent versions, authenticated browser rendering,
Google/Turnstile/session behavior, or a live transcript replay. MCP schemas and
claim validators constrain transport and evidence references; arbitrary semantic
truth still cannot be guaranteed without deterministic rendering for every
factual answer.

## Source pointers

- Repository: `workers/portfolio-mcp/src/mcp/search.ts`,
  `workers/portfolio-mcp/src/mcp/tools/search.ts`, and
  `workers/portfolio-mcp/src/mcp/schemas.ts`
- Agent: `workers/portfolio-agent/src/evidence.ts`,
  `workers/portfolio-agent/src/agent.ts`, and
  `workers/portfolio-agent/src/limits.ts`
- Tests: `tests/portfolio-mcp/protocol.test.ts`,
  `tests/portfolio-agent/evidence.test.ts`, and
  `tests/portfolio-agent/limits.test.ts`
- Canonical explanations: [[architecture/portfolio-mcp|Public Portfolio MCP
  architecture]] and [[architecture/portfolio-agent|Portfolio Assistant Agent
  architecture]]
