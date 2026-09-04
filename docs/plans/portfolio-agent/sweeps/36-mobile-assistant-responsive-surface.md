---
title: Sweep 36 — Mobile assistant responsive surface
aliases:
  - Portfolio Agent Sweep 36
tags:
  - plan
  - agents
  - frontend
  - responsive
  - accessibility
role: project-plan-sweep
status: in_progress
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-04
risk: high
---

# Sweep 36 — Mobile assistant responsive surface

Back to [[plans/portfolio-agent/README|the reliability plan]],
[[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]], or
[[architecture/portfolio-agent|the assistant architecture]].

## Objective

Make the authenticated portfolio assistant usable on phone and short-window
viewports while preserving the existing agent, authentication, thread, quota,
source, and message contracts.

## Locked responsive contract

- `(max-width: 640px), (max-height: 560px)` is a full-screen,
  safe-area-aware dialog presentation.
- The mobile presentation uses the header close action only; the floating
  trigger, desktop expand action, and mobile backdrop are not rendered while it
  is open.
- The authenticated layout keeps the transcript as the only vertical scroll
  surface. Thread controls remain on one row, quota telemetry stays collapsed,
  and the composer remains outside the transcript.
- Desktop compact and explicit expanded modes remain available above the
  responsive boundary. No backend or public API contract changes are allowed.

## Checkpoint ledger

- [x] Establish the responsive media-query state and connect it to dialog
      semantics, focus trapping, Escape handling, body-scroll locking, and
      focus restoration.
- [x] Add the mobile full-screen shell, safe-area viewport metadata, stable
      transcript/composer rows, one-line toolbar, and compact quota disclosure.
- [x] Add source regressions and an authenticated Playwright viewport matrix.
- [x] Update the canonical interaction-pattern note.
- [ ] Run the Chromium authenticated browser geometry and visual checks at
      phone, landscape, tablet, and desktop sizes.
- [ ] Complete real iPhone and Android keyboard/orientation checks.
- [x] Run the fixed app/docs/repository verification profiles and inspect the
      complete guarded diff.

## Evidence and limitations

The local TypeScript check and 106 portfolio-web tests pass after the source
changes. Targeted Biome checks pass. An authenticated Firefox replay at
`320×568`, `390×844`, `667×375`, `768×1024`, and `1280×800` observed exact
mobile viewport containment, no horizontal overflow, non-overlapping stable
rows, locked mobile page scroll, 44px-or-larger controls, and a 293px mobile
transcript at `320×568` (51.6%). This is a local Firefox result, not Chromium,
Safari, Android Chrome, or production evidence. The Chromium Playwright binary
is currently blocked before page load because it cannot load `libXext.so.6`;
this is an environment limitation. The authenticated storage state remains
local and ignored. Deployment, push, and production behavior remain separate
approval-gated checks.

## Source pointers

- Frontend: `apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx`,
  `apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistant.css`,
  and `apps/portfolio-web/index.html`
- Tests: `tests/portfolio-web/portfolio-assistant-modal.test.ts`,
  `tests/portfolio-web/portfolio-assistant.test.ts`, and
  `tests/portfolio-web/google-authenticated.spec.ts`
- Canonical interaction contract: [[design-system/interaction-patterns|interaction patterns]]
