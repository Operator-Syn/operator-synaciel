---
title: Sweep 35 — Conversational evidence grounding
aliases:
  - Portfolio Agent Sweep 35
tags:
  - plan
  - agents
  - mcp
  - grounding
  - conversation
role: project-plan-sweep
status: complete
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-03
risk: high
---

# Sweep 35 — Conversational evidence grounding

Back to [[plans/portfolio-agent/README|the reliability plan]],
[[plans/portfolio-agent/sweeps/34-cross-record-evidence-grounding|Sweep 34]], or
[[plans/portfolio-agent/audit|the audit]].

## Objective

Restore a natural conversational experience for every in-scope portfolio
question without making a hand-written vocabulary the routing authority.

## Contract

- Run one unmodified, user-only `search_portfolio` preflight and load the public
  overview when available; empty search results remain evidence for the model,
  not a deterministic refusal.
- Pass the complete discovered read-only MCP catalog to the model. The model
  decides which list, detail, repository, README, or commit tool is useful; the
  Worker does not classify questions from stop words, technology lists, or
  trigger phrases.
- Stream ordinary assistant prose with the bounded 24,000-character evidence
  context and server-owned source URLs. Previous assistant prose remains
  untrusted and never becomes grounding evidence.
- Use the provider's default reasoning setting while keeping the public
  reasoning trace available behind its disclosure.
- Keep the portfolio purpose boundary in the system contract: unrelated
  requests are declined briefly, while greetings, orientation, and follow-ups
  remain conversational.

## Implementation and evidence

- [x] Removed the local question classifier, stop-word set, technology
      vocabulary, record-kind map, and keyword-based tool filters.
- [x] Kept the shared user-only search/overview preflight and passed all
      discovered read-only MCP tools to one natural AI SDK text stream.
- [x] Restored the provider's default reasoning option while continuing to
      stream the public reasoning part.
- [x] Added regression coverage for model-led routing, empty-result handling,
      and the conversational streaming contract.

Local evidence: the focused portfolio-agent suite passes 52 tests, the MCP-fast
profile passes, and the full fixed repository profile passes on 2026-09-03.
These checks cover source and local behavior only.

## Acceptance and limitations

Generic, contact, listing, technology, and follow-up prompts now use the same
model-led stream. MCP results and the full tool catalog provide grounding, while
the system contract asks the model to decline unrelated work and acknowledge
missing evidence naturally. The transport/authentication/quota checks and the
separate unsafe-request security gate remain infrastructure boundaries; they do
not classify portfolio intent. Arbitrary semantic truth still cannot be
guaranteed by MCP schemas or prompts alone.

Deployment, authenticated browser replay, and production parity remain
unverified.

## Source pointers

- Agent: `workers/portfolio-agent/src/evidence.ts`,
  `workers/portfolio-agent/src/agent.ts`, and
  `workers/portfolio-agent/src/limits.ts`
- Tests: `tests/portfolio-agent/evidence.test.ts` and
  `tests/portfolio-agent/limits.test.ts`
- Architecture: [[architecture/portfolio-agent|Portfolio Assistant Agent
  architecture]]
