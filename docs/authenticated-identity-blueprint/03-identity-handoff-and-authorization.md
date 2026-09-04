---
title: Identity Handoff and Resource Authorization
aliases:
  - Trusted identity handoff
  - Resource-bound authorization
tags:
  - blueprint
  - identity
  - authorization
  - service-boundaries
role: reference
status: blueprint
last_verified: 2026-09-04
related:
  - "[[authenticated-identity-blueprint/01-vocabulary-and-trust-boundaries|Trust boundaries]]"
  - "[[authenticated-identity-blueprint/04-protected-realtime-gateway|Realtime gateway]]"
---

# Identity Handoff and Resource Authorization

The gateway is the authority for browser authentication, but the stateful
runtime must still validate the resource binding it receives. This prevents a
valid browser session, forged header, or stale route from becoming
cross-resource access.

## Internal handoff contract

The universal handoff is metadata carried over an authenticated private channel,
not a browser-visible credential:

```json
{
  "subject": "{{SUBJECT_ID}}",
  "session": "{{SESSION_VERSION_OR_HASH}}",
  "resource": "{{RESOURCE_ID}}",
  "authorizationEpoch": "{{EPOCH}}",
  "requestId": "{{CORRELATION_ID}}"
}
```

The exact header or RPC field is platform-specific. The handoff must be
bounded, parseable, and overwritten by the gateway. A request ID is useful for
diagnostics but has no authority. If the platform uses a signed envelope,
verify its signature, issuer, audience, expiry, and resource binding. If the
private channel supplies authenticity itself, still validate the shape and
resource match.

## Required authorization sequence

```text
onBrowserPrepare(request, resourceId):
  origin = validateBrowserOrigin(request)
  session = sessionStore.lookup(request.cookie)
  challenge = challengeStore.lookup(session)
  resource = resourceStore.ownedBy(resourceId, session.subject)
  epoch = authorizationEpoch(session.subject)
  return { subject, sessionVersion, resourceId, epoch }

onBrowserUpgrade(request, resourceId):
  repeat origin/session/challenge/resource checks
  handoff = buildServerOwnedHandoff(...)
  privateChannel.forward(requestWithoutBrowserCredentials, handoff)

onStatefulConnect(request, runtimeResourceId):
  internalAuth = verifyPrivateChannel(request)
  handoff = parseAndValidateHandoff(request)
  require handoff.resource == runtimeResourceId
  require epochIsCurrent(handoff.subject, handoff.authorizationEpoch)
  persistMinimalIdentity(handoff)
  acceptRealtimeConnection()
```

Preparation is an optimization and correlation step. It must not reserve
authorization for a later upgrade unless the adapter explicitly binds and
expires that reservation. The actual upgrade repeats the security checks.

## Header and query normalization

Before forwarding:

- delete browser `Cookie`, `Authorization`, and any browser-supplied
  identity or request-correlation header;
- set the private-channel authentication mechanism;
- set a newly serialized server-owned handoff;
- set a bounded correlation ID;
- preserve only platform connection metadata that the runtime requires;
- clear arbitrary query values before constructing the internal target.

The downstream runtime should not need to know how the browser authenticated.
It receives only the minimum identity and resource facts it needs to authorize
the connection and later work.

## Replay and stale-state handling

A handoff is not automatically single-use. Choose one of these adapter policies
and document it:

- a live session plus current epoch is checked on every upgrade and the
  connection lifetime is bounded by session policy;
- a signed, short-lived handoff includes a nonce and replay store;
- a private channel provides request authenticity and the runtime checks a
  session/version epoch before accepting work.

Do not call a correlation ID a nonce unless it is actually used in a replay
protocol. Do not claim revocation if the stateful runtime never checks the
revocation boundary.

## Adapter note

Map the private-channel authentication, handoff serialization, runtime address
binding, and header normalization in the
[[authenticated-identity-blueprint/08-cloudflare-adapter|platform adapter note]].
Keep the transport’s product names and route paths out of this portable
contract.
