---
title: Authenticated Identity Blueprint Unresolved Questions
aliases:
  - Realtime gateway follow-ups
  - Identity blueprint limitations
tags:
  - blueprint
  - audit
  - follow-up
role: audit
status: verified-repository
last_verified: 2026-09-04
related:
  - "[[authenticated-identity-blueprint|Blueprint index]]"
  - "[[authenticated-identity-blueprint/audits/evidence-ledger|Evidence ledger]]"
---

# Unresolved Questions

These items are visible limitations, not silent assumptions.

| Question or limitation | Status | Evidence | Follow-up |
| --- | --- | --- | --- |
| Does the live Pages bundle contain only the retired frontend configuration? | `potentially-outdated` | active asset still contains one unused `assistant.syn-forge.com` literal; source no longer defines the setting and runtime uses public-auth | authorize a separate Pages rebuild if byte-level removal is required; rescan the resulting asset |
| Was a production Durable Object eviction observed directly? | `unknown` | source and current platform references support hibernation; no continuous eviction telemetry was collected | use a platform-supported lifecycle test or approved low-volume observation without retaining connection secrets |
| Can the retired ES256 secret pair and historical D1 table be removed? | `unknown` / separately gated | active Workers no longer read or issue these credentials; schema and Cloudflare secret state were not destructively changed | review retention, expiry, rollback, and incident requirements before any secret deletion or migration |
| Which internal channel will another project use? | `assumption` until adapter selection | the universal contract accepts service binding, mTLS, signed envelope, or equivalent | choose one channel and document its authenticity, replay, and rotation properties |
| Does the target platform keep browser WebSockets alive during hibernation? | `unknown` until platform verification | Cloudflare supports this for its hibernatable server API; other runtimes differ | verify the platform’s lifecycle contract before adopting the runtime note |
| Is a correlation ID bound to a one-time authorization grant? | `assumption` in the universal core | the blueprint deliberately treats it as non-authorizing; adapters may add an explicit reservation if needed | document expiry, replay storage, and invalidation if a future adapter makes it a capability |
| Are browser-origin and SameSite choices compatible with local development? | `verified-repository` for this adapter; `assumption` elsewhere | current Wrangler origins and local runbook define the repository behavior | verify exact origins and cookie policy per deployment |
| Are all external references still current after dependency/runtime upgrades? | `potentially-outdated` | references include checked dates and refresh triggers | rerun targeted primary-source review at each SDK or compatibility-date change |

Do not close an item by deleting it. Replace it with a dated resolution and
update the evidence ledger and affected canonical note.
