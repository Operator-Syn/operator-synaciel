# Operator-Syn

> A working archive of software, interfaces, and ideas in progress.

[Visit Syn-Forge](https://syn-forge.com) · [Browse projects](https://syn-forge.com/projects) ·
[Read snippets](https://syn-forge.com/snippets) · [View GitHub](https://github.com/Operator-Syn)

Syn-Forge is Operator-Syn's public portfolio and learning journal. It brings together
software projects, experiments, certificates, practical code notes, and the thinking
behind them in one place.

The archive is made for recruiters, collaborators, and people considering software
development services. It gives visitors enough context to understand the work before
a conversation: start with the result, follow the details, and choose where to go deeper.

## Find your way around

| Start here | Why it helps |
| --- | --- |
| [Home](https://syn-forge.com/) | Get your bearings with profile context, selected work, tools, and current direction. |
| [Projects](https://syn-forge.com/projects) | See project summaries, media, links, and the decisions behind each experience. |
| [Certificates](https://syn-forge.com/certificates) | Follow training, workshops, and professional development. |
| [Snippets](https://syn-forge.com/snippets) | Read code snippets, reference files, and notes from the work. |
| [AI and MCP](https://syn-forge.com/ai) | Give an AI agent a public, read-only route to published portfolio information. |

## A few places to begin

The archive spans public-facing websites, internal tools, academic platforms, and
experiments in language and data.

- **[BAI Finance Website](https://www.baifinance.com.au/)** — A financial services
  platform that brings home loans, legal services, remittance information, financial
  education, and community resources into one accessible experience.
- **[BAI HR](https://www.myteambai.com/)** — A browser-based HR workspace for employee
  records, documents, leave, payroll, attendance, benefits, notifications, and
  role-specific workflows.
- **[BAI Group Website](https://bai-group-of-companies-landing-page-fork-deplo-production.up.railway.app/)** —
  A unified destination for finance, legal, migration, education, remittance, media,
  and business services.
- **[The Hootline](https://github.com/Operator-Syn/peer-tutoring-platform)** — A
  school-centered peer mentorship platform for coordinating mentors and learners,
  scheduling sessions, and sharing subject resources.

Earlier and experimental work includes student information systems and a
retrieval-based Tagalog-English intent engine.

## What this archive values

- **Evidence over buzzwords.** Project pages point to interfaces, media, repositories,
  or notes wherever those artifacts are available.
- **Useful context.** The work is presented with the problem space, the people it
  serves, and the decisions that shape the experience.
- **Practice alongside learning.** Certificates and workshops sit beside projects and
  notes so the learning path remains connected to application.
- **An archive that keeps moving.** New work and practical learnings can be added as
  the portfolio develops.

## If you're evaluating the work

A project page is the best place to understand scope, intent, and supporting evidence.
The snippets archive shows how ideas, implementation details, and recurring lessons are
recorded. The certificates archive adds formal learning alongside hands-on work.

The goal is not to make a visitor accept a list of claims. It is to make the next
useful piece of evidence easy to find.

## For AI-assisted readers

The [AI and MCP guide](https://syn-forge.com/ai) explains how to connect to Syn-Forge's
public, read-only [MCP endpoint](https://mcp.syn-forge.com/mcp). It exposes published
profile, project, certificate, and snippet information without write access.

Human readers can use the guide as another route into the archive; agents can use it
to retrieve the same published context in a structured way.

## Run the site locally

The repository is an npm monorepo. To explore the site:

```bash
npm install
npm run dev
```

To check a change:

```bash
npm run build
npm run lint
npm run docs:check
```

The public frontend lives in `apps/portfolio-web/`. The API and agent-facing
services have their own workspaces. See [Local development](docs/operations/local-development.md)
for the complete contributor workflow.

## Repository map

| Location | Purpose |
| --- | --- |
| `apps/portfolio-web/` | Public React/Vite website, static assets, and Pages Functions |
| `workers/portfolio-api/` | Portfolio data, media, and API boundary |
| `workers/portfolio-mcp/` | Public, read-only interface for AI agents |
| `tools/repository-mcp/` | Guarded local workflow for repository changes |

## Further reading

- [Documentation map](docs/README.md)
- [Local development](docs/operations/local-development.md)
- [Production deployment](docs/operations/deployment.md)
- [Public Portfolio MCP](docs/architecture/portfolio-mcp.md)
