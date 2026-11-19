---
name: operator-synaciel-onboarding
description: Onboard, resume, or review work in Operator-Synaciel.
---

# Operator-Synaciel onboarding

Use on entering the repository, recovering lost context, or starting substantial implementation or review. This is read-only orientation for the Syn-Forge portfolio monorepo, not authorization to change it or run it.

1. **Confirm scope.** Resolve the active Git root with `git rev-parse --show-toplevel`. In that root, confirm `package.json` is named `operator-synaciel` and declares both `apps/portfolio-web` and `workers/portfolio-api`. A directory name or stale session snapshot is not enough. If the signature does not match, stop using this skill. If the user named a workspace, limit orientation to that owner and any actual dependencies the task crosses.
2. **Read the live checkout.** Check `git status --short --branch --untracked-files=normal`, then `git diff --cached --name-status` and `git diff --name-status` separately. Filter to relevant paths before reading patch contents, and review relevant non-ignored additions separately. Treat staged and unstaged work as existing work to preserve. Read live `AGENTS.md`, follow `CLAUDE.md` if applicable, and look for nested instructions from the root down to each target before using its files. Skip secret-bearing files, browser state, dependency trees, caches, and generated assets.
3. **Pick a route and depth.** Read `docs/README.md` and the applicable rows of [the repository map](references/repository-map.md). For a bounded question, stop when you can point to the owner and authoritative source. For implementation, review, or recovery, open the relevant playbook linked from the map. Follow its trace through the live caller, contract, implementation, and test. If the change crosses a workspace, check the producer and consumer plus their config and tests. Name the first check that could disprove your understanding. Inspect command definitions before recommending them; routine onboarding does not install, start services, run app suites, or contact live infrastructure.
4. **Reconcile evidence.** Use source and tests to establish what the checkout does, not what is live in production. Treat accepted decisions as constraints, plans as intent, and past sweeps or archived designs as historical evidence. Use applicable instructions and explicit decisions first; if a consequential conflict remains (behavior, ownership, authorization, or overlap with local work), name the conflicting evidence and ask before choosing a direction.
5. **Hand off and continue.** Briefly record the owner, caller and contract, relevant overlapping paths (staged, unstaged, or untracked), and the first verification step. Separate checks you ran in this checkout from checks you only located or that need a live environment. Continue the user's task using that scope; do not publish a standalone onboarding report unless requested.

## Maintain the map

Update the map and affected playbooks when project boundaries, authoritative guidance, or indexed entry points change. Verify ordinary implementation changes against the live checkout rather than recording status in onboarding.

From the repository root, run `node .agents/skills/operator-synaciel-onboarding/scripts/check_repository_map.mjs` and `git diff --check`. The checker also works by absolute script path from another directory; `--root` can select another checkout of this project. It uses Node and Git only.

The checker follows the skill-to-map and map-to-playbook links and checks relative Markdown file links and table paths in those guides. Coverage includes root and nested instructions, tracked first-level architecture, API, database, and operations guides, the fixed documentation entry points, and each declared workspace's manifest, source, and tests. Review untracked additions and worktree deletions separately; do not stage or restore files to make a check pass. Trace at least one updated route manually; the checker does not validate link fragments, behavior, or deployment.
