---
title: Stage 1 — GitHub App Foundation
aliases: [Portfolio MCP GitHub App setup]
tags: [plan, github]
role: project-plan-stage
status: planned
plan_id: portfolio-mcp-github-app-rate-limit-hardening
stage: 1
milestone: M1
owner: Operator-Syn
risk: high
depends_on: []
---

# Stage 1 — GitHub App Foundation

## Objective

Create and install a GitHub App that can perform only the public, read-only REST calls required by the portfolio MCP.

## Tasks

1. Create the App under the account or organization that owns the linked portfolio repositories.
2. Set a descriptive name and leave unused event subscriptions, writes, webhooks, and callbacks disabled.
3. Grant only repository **Metadata: read-only** and **Contents: read-only** permissions.
4. Select only repositories reachable through published portfolio `project_link` records.
5. Install the App on that owner and record App ID and installation ID as non-secret deployment inputs.
6. Record the selected repository set and permission review date in the deployment handoff, not source code.

## Invariants

- Do not grant write, administration, pull-request, issue, workflow, webhook, or organization-management permissions.
- The App scope does not replace strict `https://github.com/owner/repository` parsing or the literal `main` branch boundary.
- A repository added to the App must intentionally be reachable from a published portfolio project.

## Verification

- Confirm owner, installation target, selected repositories, and read-only permissions.
- Confirm intended public repository endpoints work with a manually generated installation token in a private operator workflow; never paste the token into this vault.
- Confirm an unrelated repository is not accessible through the installation.

## Exit gate — M1

Mark `verified` only when the App exists, installation scope and permissions are reviewed, App ID and installation ID are available to the deployment owner, and no credential material entered the repository or vault.

## Rollback

Before code rollout, uninstall the App or reduce repository scope. After code rollout, use the rollback in [[plans/portfolio-mcp-github-app/stage-5-verification-rollout|Stage 5]].

## References

- [[plans/portfolio-mcp-github-app/references|Plan references]]
- [GitHub App permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub installation tokens](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)
