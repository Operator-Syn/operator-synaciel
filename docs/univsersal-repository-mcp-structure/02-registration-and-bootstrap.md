---
title: Repository MCP Registration and Bootstrap
aliases:
  - MCP registration
  - Root-safe MCP launcher
tags:
  - mcp
  - bootstrap
  - stdio
role: reference
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/01-vocabulary-and-configuration|Vocabulary]]"
---

# Registration and Bootstrap

A reproducible repository MCP starts from a client registration that discovers
the Git root, enters it, and launches the server without machine-specific paths.

## Universal sequence

1. Client invokes `{{ROOT_SAFE_LAUNCHER}}` with `{{LAUNCH_MODE}}`.
2. Launcher canonicalizes the anchor and launcher directories.
3. Launcher resolves `git rev-parse --show-toplevel` and rejects non-Git or
   outside-root execution.
4. Launcher sets `{{PROJECT_ROOT_ENV}}` and selects source or compiled entrypoint.
5. The server validates the root again, creates `{{SERVER_FACTORY}}`, and connects
   `{{TRANSPORT}}`.
6. Only protocol traffic uses stdout; startup diagnostics use stderr.

## Current registration

- `.mcp.json` is the clone-shared registration for `graphify` and
  `operator-synaciel-repository`.
- `.codex/config.toml` repeats root-safe launch for Codex, sets write approval,
  and allowlists the 13 local tools.
- Both registrations call `bash`, resolve `CLAUDE_PROJECT_DIR` when supplied,
  enter `$root`, and execute `scripts/mcp-launcher.mjs`.
- `scripts/mcp-launcher.mjs` has `repository` and `graphify` modes. The repository
  mode defaults to `tsx src/server.ts`; compiled mode requires
  `dist/server.js` and fails closed when it is absent.
- `tools/repository-mcp/package.json` owns the MCP SDK and Zod dependencies.

## Bootstrap contract

`tools/repository-mcp/src/server.ts` exports a testable factory, constructs
`McpServer` with the configured identity/instructions, calls the tool registry,
and connects `StdioServerTransport`. Its executable path validates
`validateLocalProjectRoot` before connecting. The server prints one diagnostic
line to stderr only after a successful connection.

The root validator requires a real canonical directory, `package.json`, and a
Git root equal to the configured root. A short validation cache avoids repeated
filesystem/Git probes; an explicit fresh status request bypasses it.

## Failure boundaries

- Missing Git root: launcher and server fail closed.
- Launcher outside the active checkout: reject before spawning.
- Missing source runner/dependencies: reject with an install instruction.
- Missing compiled output when compiled mode is selected: reject; do not silently
  fall back to source.
- Protocol startup text on stdout: forbidden because it corrupts stdio JSON-RPC.

Verification:
[[univsersal-repository-mcp-structure/03-tool-registry-and-contracts|next: tool registry]] ·
[[univsersal-repository-mcp-structure/12-sequential-checkpoints|checkpoint sequence]]
