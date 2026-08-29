---
title: Production Deployment
aliases:
  - Deployment
  - Production release
tags:
  - operations
  - deployment
  - cloudflare
role: runbook
---

# Production Deployment

This runbook deploys the three production surfaces in this repository:

1. the React/Vite portfolio on Cloudflare Pages at https://syn-forge.com;
2. the Hono portfolio API Worker at https://personal-portfolio.syn-forge.com; and
3. the stateless public Portfolio MCP Worker at https://mcp.syn-forge.com/mcp.

The repository is an npm monorepo. Use the surface-specific procedures below.

## Deployment topology

| Surface | Source | Production target | Deployment path |
| --- | --- | --- | --- |
| Portfolio web | apps/portfolio-web/ | Cloudflare Pages, syn-forge.com | Pages Git integration |
| Portfolio API | workers/portfolio-api/ | Worker, personal-portfolio.syn-forge.com | GitHub Actions on main (Wrangler) |
| Portfolio MCP | workers/portfolio-mcp/ | Worker, mcp.syn-forge.com | GitHub Actions on main (Wrangler) |
| Database | workers/portfolio-api/migrations/ | D1 database my-personal-portfolio | Explicit Wrangler migration command |
| Media and snippets | Portfolio API BUCKET binding | R2 bucket personal-portfolio | Existing bucket binding |

The API Worker must be available before the MCP Worker is deployed because the
MCP Worker declares a PORTFOLIO_API Service Binding. The auth-worker target must
also exist before the API Worker is deployed.

## Before a production release

### Required access and resources

Confirm access to the Cloudflare account that owns the syn-forge.com zone:

~~~bash
npx wrangler --version
npx wrangler login
npx wrangler whoami
~~~

The repository currently pins Wrangler 4.125.0 in its workspace manifests.
Run the commands from the repository root after installing dependencies with
the lockfile:

~~~bash
npm ci
~~~

The following resources must already exist or be provisioned in the same
Cloudflare account:

- the syn-forge.com zone and its DNS/certificate eligibility;
- the auth-worker Worker;
- the my-personal-portfolio D1 database;
- the personal-portfolio R2 bucket;
- the Cloudflare Pages project for the web application; and
- a Pages production branch selected in the dashboard.

The checked-in Worker configurations are authoritative for names and bindings:

- workers/portfolio-api/wrangler.toml declares portfolio-api, the DB binding,
  the BUCKET binding, the AUTH_WORKER Service Binding, and the
  personal-portfolio.syn-forge.com custom domain.
- workers/portfolio-mcp/wrangler.toml declares syn-forge-portfolio-mcp, the
  PORTFOLIO_API Service Binding, and the mcp.syn-forge.com custom domain.

### API Worker secrets

The API Worker reads these values from its bindings type:

- ACCOUNT_ID;
- R2_ACCESS_KEY_ID; and
- R2_SECRET_ACCESS_KEY.

Set them as Worker secrets. Never put their values in wrangler.toml, .env,
committed documentation, shell history, or logs:

~~~bash
npx wrangler secret put ACCOUNT_ID \
  --config workers/portfolio-api/wrangler.toml
npx wrangler secret put R2_ACCESS_KEY_ID \
  --config workers/portfolio-api/wrangler.toml
npx wrangler secret put R2_SECRET_ACCESS_KEY \
  --config workers/portfolio-api/wrangler.toml
~~~

The API uses the R2 S3-compatible endpoint and creates short-lived presigned
upload URLs. Create or use an R2 S3 API token scoped to the personal-portfolio
bucket with Object Read & Write permission, then place its Access Key ID and
Secret Access Key into the two corresponding Worker secrets. Keep the R2
token itself out of the repository.

The non-secret API values are already declared in
workers/portfolio-api/wrangler.toml:

- VITE_CDN_URL points to the public media hostname;
- R2_BUCKET_NAME is personal-portfolio;
- DB targets my-personal-portfolio;
- BUCKET targets personal-portfolio; and
- AUTH_WORKER targets auth-worker.

Do not add the API secrets to the MCP Worker. The MCP Worker only needs its
PORTFOLIO_API Service Binding in production.

## GitHub Actions Worker deployment

The checked-in [production Worker workflow](../../.github/workflows/deploy-production-workers.yml)
runs for every push to `main` and supports a manual `workflow_dispatch` recovery run from the Actions tab. Manual runs must select `main`; each job checks the ref so another branch cannot deploy. Its validation job installs the lockfile
dependencies and runs the repository typecheck, lint, Biome, build, application
tests, documentation check, repository MCP check, and public MCP check. After
validation succeeds, the workflow dry-runs and deploys `portfolio-api`, then
dry-runs and deploys `syn-forge-portfolio-mcp`.

To start a run manually, open the Actions tab, choose `Deploy production Workers`, select the `main` branch, and choose **Run workflow**.

The API deploy completes before the MCP deploy so the MCP Worker's
`PORTFOLIO_API` Service Binding continues to target the available API Worker.
The workflow uses Wrangler 4.125.0 and an account-scoped Cloudflare API token.

### Configure GitHub Actions secrets

Add these GitHub repository secrets before pushing to `main`:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Create the token from Cloudflare's [GitHub Actions deployment
guidance](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
using the account-scoped **Edit Cloudflare Workers** template, then restrict it
to the account that owns these Workers. Never commit either secret value or
hard-code it in a workflow file.

The workflow passes only the deployment token and account ID to Wrangler. It does
not pass the API Worker's runtime secrets (`ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, or `R2_SECRET_ACCESS_KEY`), apply D1 migrations, or deploy
the separately managed `auth-worker`.

The frontend is intentionally not uploaded by this workflow. Cloudflare Pages
continues to use its existing Git integration and starts its own production
deployment for the same `main` push. Pages and Worker releases are therefore
coordinated by the push but are not one atomic deployment.

## Preflight verification

Run the repository checks before changing production:

~~~bash
npm run typecheck
npm run lint
npm run check:biome
npm run build
npm run docs:check
npm run mcp:check
npm run skills:check
npm run mcp:typecheck
npm run test:mcp
npm run mcp:portfolio:check
npm run test:portfolio-mcp
npm run test:media-presign
npm run test:project-pagination
npm run test:social-preview
~~~

Review the complete diff and confirm that generated output, secrets, local
configuration, and unrelated work are not included:

~~~bash
git diff --check
git status --short
git diff --stat
~~~

Refresh the code graph after source changes:

~~~bash
pipenv run graphify update . --no-cluster
~~~

Do not treat a successful build or dry run as proof that the deployed service is
live. Continue with the deployment and post-deployment checks below.

## Database migration release

A Worker deployment never applies D1 migrations. If the release contains a
schema change, review and apply the migration separately.

Generate a migration only after changing the Drizzle schema:

~~~bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
git diff -- workers/portfolio-api/src/db/schema.ts \
  workers/portfolio-api/migrations/ \
  workers/portfolio-api/drizzle.config.ts \
  workers/portfolio-api/wrangler.toml
~~~

For a reviewed custom SQL change, use the repository script:

~~~bash
npm run db:migration:custom -- --name=backfill_descriptive_change
npm run db:migration:check
~~~

Apply and inspect the database in this order:

~~~bash
npm run db:migrations:list:local
npm run db:migrations:apply:local
npm run db:migrations:list:remote
~~~

Only after reviewing the SQL, local result, and remote pending list may an
authorized operator apply the remote migration:

~~~bash
npm run db:migrations:apply:remote
~~~

Do not replay Initial-Seed.sql as migration history. Do not edit an applied
migration or files under migrations/meta/; use a new forward migration for
corrections. If there are no pending migrations, record that the remote list was
checked and continue. Migration application is a production-data operation and
is not performed by this runbook automatically.

## Deploy the portfolio API Worker

Deploy the API before the MCP Worker.

First run the Wrangler dry run:

~~~bash
npx wrangler deploy --dry-run \
  --config workers/portfolio-api/wrangler.toml
~~~

The portfolio-api workspace has no deploy npm script. The production deploy is
the explicit Wrangler command without --dry-run:

~~~bash
npx wrangler deploy \
  --config workers/portfolio-api/wrangler.toml
~~~

Alternatively:

~~~bash
cd workers/portfolio-api
npx wrangler deploy
~~~

Confirm that the deployment reports the expected Worker and custom domain. A
successful upload does not prove that D1, R2, the auth binding, or public routes
work.

## Configure and deploy Cloudflare Pages

### Pages project settings

Use Cloudflare Pages Git integration for this repository. Configure the
project with:

| Setting | Value |
| --- | --- |
| Repository | Operator-Syn/operator-synaciel |
| Root directory | apps/portfolio-web |
| Build command | npm run build |
| Build output directory | dist |
| Production branch | The branch selected for production in Pages |
| Production custom domain | syn-forge.com |

Set this production Pages environment variable. It is a public build-time URL,
not a secret:

~~~text
VITE_API_URL=https://personal-portfolio.syn-forge.com/api
~~~

The Vite configuration loads environment values from the repository root and
the frontend requests routes beneath VITE_API_URL. Do not set this to the MCP
endpoint.

Pages discovers apps/portfolio-web/functions/. The checked-in
apps/portfolio-web/public/_routes.json is copied into the build output and
keeps static assets, llms.txt, robots.txt, and the sitemap outside the Pages
middleware where configured. Do not replace this Functions deployment with a
static-only upload.

On first setup, choose Save and Deploy in the Pages dashboard. Subsequent
production pushes to the selected branch trigger Git-integrated builds. Review
the build log and production deployment URL before checking the custom domain.

### Local Pages checks

Build and inspect the same output locally:

~~~bash
npm run build
npm run pages:dev
~~~

The root preview script builds the frontend and serves dist locally:

~~~bash
npm run preview
~~~

### Direct Upload alternative

Use Direct Upload only if the Pages project was created for Direct Upload.
Git-integrated Pages projects cannot be switched to Direct Upload later:

~~~bash
npm run build
npx wrangler pages deploy apps/portfolio-web/dist \
  --project-name <PAGES_PROJECT_NAME>
~~~

The project name is a Cloudflare account setting and is intentionally not
hardcoded here. Confirm the Pages project mode before using this alternative.

## Deploy the public Portfolio MCP Worker

The API Worker must already exist so the PORTFOLIO_API Service Binding can
resolve.

Validate the production bundle:

~~~bash
npx wrangler deploy --dry-run --env="" \
  --config workers/portfolio-mcp/wrangler.toml
~~~

Deploy through the checked-in npm script:

~~~bash
npm run mcp:portfolio:deploy
~~~

The script uses the top-level production configuration. The env.local block is
for local development only. Production uses the PORTFOLIO_API Service Binding
and mcp.syn-forge.com custom domain.

The MCP Worker is public and unauthenticated. Its public data reads are cached
for six hours at the portfolio API transport boundary. Cache entries are local
to the data center that fills them, and content updates may remain visible for
up to six hours. Deployment does not purge already-warmed cache entries.

## Post-deployment verification

### API smoke checks

~~~bash
curl --fail --silent --show-error \
  https://personal-portfolio.syn-forge.com/api/settings
curl --fail --silent --show-error \
  https://personal-portfolio.syn-forge.com/api/profile
curl --fail --silent --show-error \
  'https://personal-portfolio.syn-forge.com/api/v2/projects/archive?limit=1'
curl --fail --silent --show-error \
  'https://personal-portfolio.syn-forge.com/api/v2/certificates/archive?limit=1'
curl --fail --silent --show-error \
  https://personal-portfolio.syn-forge.com/api/snippets
~~~

Verify that public reads return data or expected empty collections, and that a
private route does not become public without an auth_token cookie:

~~~bash
curl --include --silent --request POST \
  https://personal-portfolio.syn-forge.com/api/project
~~~

Do not paste cookies, tokens, presigned URLs, or private response contents into
logs or issue reports.

### Pages checks

~~~bash
curl --fail --silent --show-error --head https://syn-forge.com/
curl --fail --silent --show-error https://syn-forge.com/llms.txt
curl --fail --silent --show-error --head https://syn-forge.com/robots.txt
curl --fail --silent --show-error --head https://syn-forge.com/sitemap.xml
~~~

Open representative routes in a browser and confirm the home, projects,
certificates, snippets, and AI pages load; route-specific metadata is present
for crawler HTML requests; static files are not rewritten by Pages middleware;
and the browser console has no deployment-specific errors.

### MCP checks

Register https://mcp.syn-forge.com/mcp in an MCP-capable client and confirm:

- the endpoint initializes;
- tools/list exposes the eight public tools;
- resources/list exposes the four portfolio resources;
- get_portfolio_overview returns the current public overview;
- search_portfolio returns bounded results;
- list_projects and list_certificates support documented limits and cursors;
- list_snippets and read_snippet return expected metadata/content behavior; and
- an untrusted browser Origin is rejected.

Inspect live logs while making a representative request:

~~~bash
npx wrangler tail syn-forge-portfolio-mcp
~~~

The Worker configuration enables invocation logs. Do not log portfolio document
contents or credentials.

### Deployment records

Record the deployment version, commit, time, and verification result. Wrangler
and the Cloudflare dashboard expose Worker versions and deployments. Pages
exposes the production deployment and associated commit.

## Rollback and recovery

### Worker rollback

List recent deployments before selecting a target:

~~~bash
npx wrangler deployments list --name portfolio-api
npx wrangler deployments list --name syn-forge-portfolio-mcp
~~~

Rollback the affected Worker using a reviewed version ID or the previous version:

~~~bash
npx wrangler rollback --name portfolio-api
npx wrangler rollback --name syn-forge-portfolio-mcp
~~~

A Worker rollback immediately creates a new deployment across its routes and
domains. It does not roll back D1 or R2 state. If code and storage schema are
incompatible, restore service with a forward-compatible change instead of
blindly rolling back.

For Pages, use the Pages dashboard deployment history to retry or roll back
the production deployment. Confirm the custom domain remains attached.

### Database recovery

Do not reverse an applied D1 migration by editing its SQL. Review remote
migration state and use a new forward migration or an approved backup recovery
procedure. Coordinate code rollback with the actual D1 schema and R2 object
state.

## Complete release checklist

- [ ] Cloudflare account access verified with npx wrangler whoami.
- [ ] auth-worker exists and is reachable through the API Worker binding.
- [ ] D1 database and R2 bucket names match wrangler.toml.
- [ ] API Worker secrets exist and are scoped appropriately.
- [ ] npm ci completed from the repository root.
- [ ] GitHub Actions secrets are configured for Worker deployment.
- [ ] The main-branch validation job passed before Worker deployment.
- [ ] Repository checks and targeted tests passed.
- [ ] Any D1 migration was reviewed, tested locally, listed remotely, and
      explicitly authorized before application.
- [ ] portfolio-api dry run passed.
- [ ] portfolio-api deployed before portfolio-mcp.
- [ ] Pages root, build command, output directory, production branch, and
      VITE_API_URL are correct.
- [ ] Pages production deployment and custom domain verified.
- [ ] portfolio-mcp dry run passed.
- [ ] portfolio-mcp deployed with its Service Binding.
- [ ] API, Pages, and MCP smoke checks passed.
- [ ] Live logs were checked without exposing secrets or portfolio contents.
- [ ] Deployment version and commit recorded.
- [ ] Rollback target identified.

## Source references

Repository sources:

- [Production Worker deployment workflow](../../.github/workflows/deploy-production-workers.yml)
- [Root scripts](../../package.json)
- [Portfolio web manifest](../../apps/portfolio-web/package.json)
- [Portfolio web Vite configuration](../../apps/portfolio-web/vite.config.ts)
- [Pages Functions middleware](../../apps/portfolio-web/functions/_middleware.ts)
- [Pages route configuration](../../apps/portfolio-web/public/_routes.json)
- [Portfolio API manifest](../../workers/portfolio-api/package.json)
- [Portfolio API Wrangler configuration](../../workers/portfolio-api/wrangler.toml)
- [Portfolio API bindings](../../workers/portfolio-api/src/bindings.ts)
- [Portfolio MCP manifest](../../workers/portfolio-mcp/package.json)
- [Portfolio MCP Wrangler configuration](../../workers/portfolio-mcp/wrangler.toml)
- [D1 migration workflow](../database/migrations.md)
- [Architecture overview](../architecture/overview.md)
- [Public Portfolio MCP](../architecture/portfolio-mcp.md)

Current Cloudflare references:

- [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Worker deploy command](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [GitHub Actions deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Worker configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [R2 S3 authentication](https://developers.cloudflare.com/r2/get-started/s3/)
- [Worker versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
- [Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Real-time Worker logs](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)
