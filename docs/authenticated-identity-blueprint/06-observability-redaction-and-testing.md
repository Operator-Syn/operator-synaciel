---
title: Observability Redaction and Testing
aliases:
  - Realtime security telemetry
  - Redacted browser audit
tags:
  - blueprint
  - observability
  - testing
  - security
role: guide
status: blueprint
last_verified: 2026-09-04
related:
  - "[[authenticated-identity-blueprint/01-vocabulary-and-trust-boundaries|Trust boundaries]]"
  - "[[authenticated-identity-blueprint/04-protected-realtime-gateway|Realtime gateway]]"
  - "[[authenticated-identity-blueprint/09-sequential-checkpoints|Luna checkpoints]]"
---

# Observability, Redaction, and Testing

Observability should explain which boundary failed without becoming a second
credential exfiltration channel. Record lifecycle facts, not request contents.

## Diagnostic contract

A portable event can use this shape:

```json
{
  "phase": "gateway | runtime | upstream | quota | model",
  "outcome": "started | succeeded | failed | rejected | skipped",
  "reason": "bounded-enum-or-omitted",
  "elapsedMs": 0,
  "attempt": 1,
  "requestId": "{{OPAQUE_CORRELATION_ID}}"
}
```

Only allowlisted fields and bounded values may pass the diagnostic sink. Omit
question text, cookies, authorization headers, raw URLs, provider payloads,
stack traces, private claims, and upstream response bodies. A diagnostic sink
failure must never change the user-visible result.

## Browser redaction

The browser audit should:

1. parse each request and WebSocket URL;
2. retain origin, path, and parameter names only;
3. flag JWT-shaped values and sensitive parameter names;
4. detect page errors, request failures, socket errors, and premature-close text;
5. ignore only an explicitly identified third-party noise event;
6. assert that no unexpected failure event remains;
7. write no trace, HAR, cookie jar, or raw response artifact.

```text
inspect(url):
  parsed = parse(url)
  names = uniqueLowercaseQueryNames(parsed)
  exposed = jwtShape(url) OR names intersect {token, access_token, id_token, authorization, jwt}
  return { exposed, safeUrl: origin + path + sorted(names) }
```

Redaction must happen before an event is stored, printed, uploaded, or attached
to a test report. A redacted URL is still evidence about route shape, not proof
that the credential was never exposed elsewhere.

## Test layers

| Layer | Proves | Does not prove |
| --- | --- | --- |
| Parser/unit | handoff shape, origin policy, URL redaction, failure mapping | deployed routing |
| Boundary/integration | ownership, header stripping, private-channel authentication, upgrade statuses | provider capacity |
| Runtime lifecycle | restart/hibernation rehydration and message continuity | every platform eviction condition |
| Browser | actual cookie flow, URL shape, console/page/socket errors, UI recovery | all users and browsers |
| Live smoke | representative deployed behavior and version pairing | long-term load or incident absence |
| Log review | allowlisted fields and absence of sensitive values | a perfect global log search |

## Adapter test inventory

Record the adapter’s parser, boundary, lifecycle, browser, live-smoke, and
redaction tests in the
[[authenticated-identity-blueprint/audits/evidence-ledger|evidence ledger]].
Authentication state must be created manually, ignored by version control,
permission-restricted, and never printed or copied into an artifact. Keep paid
or state-changing live tests opt-in.

## Failure scenarios to exercise

- missing, expired, revoked, or disabled session;
- invalid origin or CSRF attempt;
- unverified challenge or administrator pause;
- foreign or malformed resource ID;
- forged identity/request headers;
- missing or wrong private-channel credential;
- absent WebSocket upgrade;
- upstream discovery timeout or partial catalog;
- stateful runtime restart after idle;
- premature close before `101`;
- browser request/socket failure;
- deployment version skew;
- redaction detector receives a JWT-shaped test fixture.

Tests must assert both the safe response shape and that the failing layer does
not receive data it should not see.
