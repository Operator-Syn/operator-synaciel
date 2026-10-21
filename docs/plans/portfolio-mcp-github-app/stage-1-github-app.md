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
4. Install the App on **All repositories**. Do not select individual repositories; GitHub has no "all public only" installation mode.
5. Set `GITHUB_INSTALLATION_OWNER=Operator-Syn` as non-secret Worker configuration and record App ID and installation ID as deployment inputs.
6. Keep every runtime installation token narrowed to one portfolio-linked repository and record the permission review date in the deployment handoff.

## Invariants

- Do not grant write, administration, pull-request, issue, workflow, webhook, or organization-management permissions.
- The Worker accepts only the configured Operator-Syn owner and narrows each token request to one repository.
- The App installation does not replace strict `https://github.com/owner/repository` parsing, the published-project link boundary, the fresh public-visibility gate, or the literal `main` branch boundary.
- Adding a new public Operator-Syn repository to a published project must work without editing the App installation.

## Verification

- Confirm owner, **All repositories** installation target, and read-only permissions.
- Confirm a one-repository installation token reaches a linked public repository in a private operator workflow; never paste the token into this vault.
- Confirm third-party owners are rejected before token exchange and that private or unlinked repositories remain unavailable.
- Confirm a newly linked public Operator-Syn repository works without changing the App installation.

## Exit gate — M1

Mark `verified` only when the App exists on **All repositories**, runtime owner/repository narrowing and permissions are reviewed, App ID and installation ID are available to the deployment owner, and no credential material entered the repository or vault.

## Rollback

Before code rollout, uninstall or suspend the App. After code rollout, use the rollback in [[plans/portfolio-mcp-github-app/stage-5-verification-rollout|Stage 5]].

## References

- [[plans/portfolio-mcp-github-app/references|Plan references]]
- [GitHub App permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub installation tokens](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)
