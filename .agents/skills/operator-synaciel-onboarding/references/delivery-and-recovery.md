# Delivery, verification, and interrupted-work recovery

Companion to the repository map. This note is read-only orientation: it does
not authorize installing dependencies, starting servers, opening an
authenticated browser session, contacting Cloudflare, deploying, applying a
migration, or writing Git state. Those remain separately authorized operations,
and the deployment runbook owns their exact commands.

## Choose the mode first

Decide which of three situations you are in before reading source. The mode
chooses the first check; it does not change the workspace.

- **New work.** The user names a change and no local work matches it. Confirm
  the owning workspace, then read the governing guide and the live entry point.
- **Recover.** The worktree carries changes whose intent is not obvious.
  Reconstruct the intent from the three Git views, then state the resumption
  point before editing anything.
- **Review.** A fixed base exists and a diff needs judgment. Establish the base
  (commit, branch, or pull request), read the complete diff, then the affected
  contract and tests.

Do not infer the mode from the branch name. A clean production branch can carry
staged work, and a dirty tree can be review evidence rather than unfinished
work.

## Recover interrupted work

Read in this order; each step is a query, not a mutation.

1. Resolve the Git root, then the current branch and its upstream.
2. Read the short status with untracked files shown at normal granularity. This
   gives the shape of staged, unstaged, and untracked work in one pass.
3. Read the staged name-status view and the unstaged name-status view
   separately. Staged work is a batch someone chose; unstaged work is a batch
   nobody has chosen yet.
4. List untracked, non-ignored additions and worktree deletions separately.
   A deletion is evidence too.
5. Identify the instruction files that apply to each target path (root, then
   nested) before opening the target.

Never stage, restore, clean, stash, or check out to make the state easier to
read. That destroys the evidence you are reconstructing.

### What to capture

Record only what a later session cannot cheaply re-derive:

- the repository root and the active branch with its upstream;
- the three path sets (staged, unstaged, untracked) filtered to the task;
- the owning workspace and the applicable instruction files;
- the last known intent and the checks already run, including the first failing
  or unverified assertion and its actual output;
- the paths deliberately left alone.

Do not record volatile counts, file sizes, or a paste of the whole status. They
change under the next worker and hide the path sets that matter.

### Worked resumption example

A checkout is on the production branch, level with its upstream. Staged work
deletes editor-configuration files at the root and under the documentation
vault. Unstaged work removes a large `.codex/skills/` tree and corresponding
`tools/` content while adding the same skills under `.agents/skills/`; other
unstaged edits touch `AGENTS.md`, `package.json`, `workers/`, and `docs/`.
Untracked additions are the new skill directories that the deletion half
expects. The user last asked for deeper onboarding, not a rebuild.

- Wrong recovery: one "cleanup" commit, or restoring the deleted tree so the
  status looks simple.
- Right recovery: four batches — editor config, skill relocation, repository
  metadata, and the onboarding reference. Confirm which batch is live before
  editing; the relocation explains the deletions, so they are not stray.
- Resumption point: the onboarding skill owns the task; the first meaningful
  check is a targeted read of the skill and its map, not the full repository
  suite. Everything else stays untouched.

### When to stop for overlap

Stop before the first write and report when any of these is true:

- a file you intend to edit already appears in staged or unstaged changes you
  did not make;
- two batches change the same contract (schema and migration, route and
  middleware, workflow and detector);
- an untracked file may be another worker's in-progress output;
- the intent of existing work cannot be reconstructed from the diff.

Name the overlapping paths, say what you would have changed, and ask. Never
resolve an overlap by overwriting one batch with the other, and never discard
untracked work to remove ambiguity.

## Verification ladder

Four levels, weakest to strongest. A lower level never proves a higher one.

| Level | Start here | What it proves, and what it does not |
| --- | --- | --- |
| Contract | `docs/README.md`, `docs/architecture/repository-layout.md` | Names the owner, seam, and accepted decision. Proves nothing about behavior. |
| Local source and mocked behavior | `docs/operations/local-development.md`, `package.json` | Typecheck and lint inspect source; Node/tsx tests exercise the cases and fakes they name. These checks do not, by default, run a local D1 instance, Cloudflare service bindings, or a browser. |
| Authenticated browser | `docs/operations/local-development.md`, `apps/portfolio-web/playwright.config.ts` | The default suite reuses saved session state and checks the configured app/gateway; it does not prove the OAuth login flow or a live model turn. Inspect each spec's gate and the endpoints under test. |
| Deployed | `docs/operations/deployment.md` | The released version, custom domain, and live routes answer. Only this level proves production. |

For dependency-backed checks, use a supported Node runtime (CI uses Node 22)
and the installed lockfile dependencies. The onboarding checker needs only
Node and Git. Do not install, build, or start a service merely to orient; read
the manifests first and identify the narrowest check the task actually needs.

`npm run build` is a typecheck plus the frontend build. It does not bundle a
Worker, and a Worker dry run only validates the selected Wrangler
configuration. Neither is live verification.

The runbooks describe a teaser policy for `main` and route authenticated checks
to an active assistant build. Check `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantAvailability.ts`
in the live checkout: the branch name alone does not establish that mode. If
the gate and runbook disagree, report the source/policy conflict instead of
changing the gate or inferring the deployed mode. `npm run test:e2e` reuses or
starts Vite and loads a saved session; the live model turn and context replay
are separate approval-gated commands that consume provider quota. A stored
session is a live credential: keep it out of diffs, logs, and reports.

### First meaningful check by change

Pick one row, read its start-here documents, then trace the listed seam. Do not
re-run the entire deployment runbook for a source change.

| Task | Start here | Trace and verify |
| --- | --- | --- |
| Change a page or interaction | `docs/PRODUCT.md`, `docs/DESIGN.md` | `apps/portfolio-web/src/App.tsx`, `apps/portfolio-web/src/components/`, `apps/portfolio-web/tests/` |
| Change Pages routing, sitemap, or preview | `docs/operations/deployment.md`, then the sitemap policy in `apps/portfolio-web/src/data/sitemap.ts` | `apps/portfolio-web/functions/_middleware.ts`, `apps/portfolio-web/functions/routePolicy.ts`, `apps/portfolio-web/public/_routes.json`, `apps/portfolio-web/src/data/sitemap.ts`. The sitemap owns its own cache policy (public, max-age=300, s-maxage=3600, stale-while-revalidate=86400) and a last-known-good fallback before a 503; docs/operations/deployment.md still says the XML response uses a no-store cache header, so read the source, not the runbook, for that line. |
| Change an API route or write boundary | `docs/api/routes.md`, `docs/architecture/layer-boundaries.md` | `workers/portfolio-api/src/entrypoint.ts`, `workers/portfolio-api/src/controller/`, `workers/portfolio-api/src/model/`, `workers/portfolio-api/tests/write-boundary.test.ts` |
| Change the public MCP contract | `docs/architecture/portfolio-mcp.md` | `workers/portfolio-mcp/src/mcp/handler.ts`, `workers/portfolio-mcp/src/mcp/server.ts`, `workers/portfolio-mcp/src/mcp/tools/`, `workers/portfolio-mcp/tests/protocol.test.ts` |
| Change sign-in, sessions, or the gateway | `docs/architecture/portfolio-public-auth.md` | `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts`, `workers/portfolio-public-auth/src/index.ts`, `workers/portfolio-agent/src/index.ts` |
| Change schema or a migration | `docs/database/schema.md`, `docs/database/migrations.md` | `workers/portfolio-api/src/db/schema.ts`, `workers/portfolio-api/drizzle.config.ts`, `workers/portfolio-api/migrations/` |
| Review CI or deploy selection | `docs/operations/deployment.md` | For whether a change selects a release, start with `scripts/tests/detect-deploy-targets.test.ts`, which exercises the detector with Git fixture history. For workflow wiring, compare `.github/workflows/deploy-production-workers.yml` and `scripts/tests/deployment-paths.test.ts`. |
| Diagnose a browser-only assistant issue | `docs/operations/local-development.md` | `apps/portfolio-web/playwright.config.ts`, `apps/portfolio-web/tests/playwright-observability.ts` |

There is no local repository MCP server to configure. The MCP surface is the
remote Worker under `workers/portfolio-mcp/`; the historical blueprint under
`docs/univsersal-repository-mcp-structure/` is background, not a local setup
guide.

## Pages and Workers are independent releases

Pages builds from `apps/portfolio-web/` through its own Git integration: that
workspace is the project root, `npm run build` is the build command, and `dist`
is the output directory. Its Functions come from `apps/portfolio-web/functions/`
and its route manifest from `apps/portfolio-web/public/_routes.json`.

The checked-in workflow deploys only the four Workers, on pushes to `main`, in
the order API, MCP, agent, then public-auth. The same commit coordinates both
paths but does not make them atomic. Concretely:

- a Worker-only change runs full validation and redeploys no Pages bundle;
- a Pages-only change runs full validation and redeploys no Worker;
- the workflow is restricted to `main`, while the Pages production branch is a
  Pages project setting; the assistant development branch is neither a Worker
  deploy trigger nor a valid Pages production target;
- a successful Worker upload says nothing about the Pages deployment, and a
  successful Pages build says nothing about Worker bindings.

Verify each surface on its own evidence: the Pages build log and deployment URL
for the frontend, and the Worker deployment plus smoke checks for each Worker.

## Deploy selection, fail-open, and test-only changes

`scripts/detect-deploy-targets.mjs` answers "is production stale for this
Worker?", not "did this push touch this workspace?". It compares a per-Worker
ledger tag against the current commit across the paths that can change that
Worker's bundle.

- One tag per Worker records its last successful deploy; the deploy job
  force-moves the tag only after a successful release.
- The lockfile belongs to every target, so a dependency change redeploys all
  four Workers.
- Tests are excluded, so a test-only change runs the full validation suite and
  deploys nothing.
- A failed deploy never advances its tag, so the next run retries that Worker
  even when the new push is unrelated. This is the self-healing part.
- Deploy conditions test "not false" rather than "true". An unreadable ledger
  therefore deploys everything: skipping is the unsafe outcome, a redundant
  deploy is not.
- A tag push that fails does not fail the deploy job; it costs one redundant
  redeploy on the next run.
- The manual `force` input redeploys every Worker regardless of ledger state.

Validation and release are different claims. `scripts/tests/deployment-paths.test.ts`
and `scripts/tests/detect-deploy-targets.test.ts` prove the path rules and gate
logic; they do not prove that a release ran.

## D1 changes need separate approval

The editable schema and API migrations belong to `workers/portfolio-api/`.
Auth-owned state belongs to `workers/portfolio-public-auth/migrations/` and is
described by `docs/architecture/portfolio-public-auth.md`.

The review order is fixed: change the schema, generate one readable forward
migration, check it, read the SQL and the narrow diff, list and apply locally,
inspect the result, list remotely, and only then let an authorized operator
apply remotely. Listing is read-only; application is a production-data
operation.

- A Worker deploy never applies generic API migrations.
- The public-auth release wrapper is the explicit exception: it applies its
  reviewed auth migrations before deploying, and its migrations through the
  reservation-state change must be applied before the assistant Workers ship.
- Never replay the seed file as migration history, never edit an applied
  migration, and never hand-edit the Drizzle metadata directory. Correct with a
  new forward migration.
- Run the auth migrations locally with the local profile only; do not point the
  local command at the remote database as part of frontend testing.

## Hand off what you actually established

Close orientation with the owning workspace, the paths and contracts read, the
checks run and their results, the verification level reached, overlapping work
left untouched, and what remains unverified. If the task continues, continue it
in that scope rather than publishing a separate onboarding report.
