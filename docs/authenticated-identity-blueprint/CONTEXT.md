# Authenticated Identity and Realtime Context

This glossary fixes the language used by the reusable blueprint. Definitions
describe what a concept is, not how one particular framework implements it.

## Identity

**Principal**:
The stable subject to whom an authorization decision applies.
_Avoid_: account, user, customer, caller

**Claim**:
An authenticated attribute about a principal or session that a verifier may use
for an authorization decision.
_Avoid_: arbitrary metadata, trusted input

**Resource**:
The single application object whose access and state are being protected.
_Avoid_: target, entity, whatever the route names it

**Authorization epoch**:
A monotonically changing version that invalidates earlier authorization
decisions for a principal.
_Avoid_: token version, refresh counter

## Session and proof

**Session**:
A server-owned authenticated browser context represented to the browser by an
opaque identifier.
_Avoid_: access token, JWT, browser credential

**Credential**:
Secret proof that can establish or extend authority, such as a session secret,
bearer token, private key, or challenge response.
_Avoid_: request ID, attempt ID, trace ID

**Verifier**:
The boundary that validates a credential or authenticated assertion before it
is used for authorization.
_Avoid_: parser, middleware, router

**Revocation**:
An explicit state transition that makes a previously valid session, claim, or
authorization unusable.
_Avoid_: logout-only, expiry-only

## Boundaries and transport

**Gateway**:
The public boundary that authenticates and authorizes a request before
forwarding a narrowly shaped operation to a private runtime.
_Avoid_: proxy, pass-through, frontend helper

**Handoff**:
A trusted internal identity assertion bound to one principal, session state, and
resource for the duration of a downstream operation.
_Avoid_: forwarded browser headers, query token

**Correlation ID**:
A non-secret value used to connect related events in diagnostics. It never
proves identity, ownership, or permission.
_Avoid_: nonce, auth token, capability

**Internal channel**:
A private or authenticated service-to-service path that is not reachable as a
browser-controlled public endpoint.
_Avoid_: hidden URL, obscure route

## Stateful execution

**Stateful runtime**:
A resource-scoped actor whose in-memory work is backed by durable state and
whose concurrency boundary is part of the authorization design.
_Avoid_: global singleton, shared cache

**Hibernation**:
A platform lifecycle in which an idle stateful runtime may leave memory while a
supported realtime connection remains managed by the platform.
_Avoid_: process sleep, disconnected socket

**Upstream dependency**:
A network or provider operation needed for application work but not for proving
that a realtime connection is authorized and established.
_Avoid_: handshake prerequisite
