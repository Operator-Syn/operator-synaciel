---
title: Obsidian Vault and Skills
aliases:
  - Obsidian
  - Documentation vault
tags:
  - tooling
  - documentation
role: guide
---

# Obsidian Vault and Skills

The repository's `docs/` directory is the project Obsidian vault. It remains
ordinary Markdown so GitHub, Codex, and other repository tools can read the
same source.

## Native Codex installation

The `codex-obsidian` plugin is installed through Codex's native Git marketplace
flow. It is not vendored into this repository and its cache remains outside the
worktree. The current verified upstream ref is
`ed35c3782639f792d0338f0b0da7d8a5484b7b56`.

Install the plugin directly from GitHub:

```bash
codex plugin marketplace add greg-asher/codex-obsidian \
  --ref ed35c3782639f792d0338f0b0da7d8a5484b7b56
codex plugin add codex-obsidian@lumicorp-marketplace
```

Verify the native marketplace and installed plugin:

```bash
codex plugin marketplace list --json
codex plugin list --marketplace lumicorp-marketplace --json
```

The upstream plugin currently provides seven skills:

- `obsidian-official-cli`
- `obsidian-cli-bases-and-bookmarks`
- `obsidian-cli-runtime-admin`
- `obsidian-cli-devtools`
- `obsidian-cli-sync-and-publish`
- `obsidian-cli-workspace-and-navigation`
- `obsidian-cli-workflows`

When updating the source, select and verify a new upstream Git ref, refresh the
configured marketplace, and reinstall the plugin through Codex. Do not add a
repository-local skill mirror as part of that update.

## Official CLI boundary

Use the official desktop `obsidian` CLI for vault-aware reads, links,
properties, history, and other supported Obsidian operations. Resolve exact
paths before reads or writes; do not rely on an unspecified active file.

The vault map is [[README]]. Open this repository's `docs/` directory through
the Obsidian desktop vault switcher once and register it with a stable name,
such as `operator-synaciel-docs`. Then verify the native index and links:

```bash
obsidian vaults verbose
obsidian vault="operator-synaciel-docs" files ext=md total
obsidian vault="operator-synaciel-docs" outline path=README.md format=json
obsidian vault="operator-synaciel-docs" links path=README.md
obsidian vault="operator-synaciel-docs" orphans total
```

The normal repository editing workflow remains valid when the desktop CLI is
unavailable. Do not claim live CLI verification unless the new vault appears
in `obsidian vaults` and a read-only command succeeds.

Personal workspace, theme, cache, and appearance state is not part of the
repository documentation contract.
