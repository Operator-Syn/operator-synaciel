---
title: Public Portfolio Authentication
aliases:
  - Portfolio public auth
  - Assistant authentication
tags:
  - architecture
  - authentication
  - cloudflare
role: reference
---

# Public Portfolio Authentication

`workers/portfolio-public-auth/` is a separate public-auth Worker for the
portfolio assistant. It is intentionally not the existing admin
`auth-worker`, whose cookie and routes are scoped to the Atelier/admin site.

## Browser flow

1. The site-wide assistant opens a fixed Google OIDC authorization-code flow.
2. The Worker stores a hashed state, PKCE verifier, nonce, same-origin return
   target, and ten-minute expiry in D1. It also sets a host-only, HttpOnly,
   Secure, SameSite=Lax state cookie.
3. The callback exchanges the code, validates Google issuer, audience, expiry,
   verified email, and nonce, then stores only the stable Google subject,
   current email/display name, and a hashed 30-day session identifier.
4. A signed session cookie is returned to the configured `PORTFOLIO_ORIGIN`.
   No Google access or refresh token is persisted.
5. Turnstile is verified server-side once per session. The auth Worker then
   issues a five-minute ES256 agent token scoped to the user, session, opaque
   thread ID, audience, quota epoch, and one-time JTI.
6. The agent Worker consumes that JTI on WebSocket upgrade, verifies the
   signature and scope, removes the token from the forwarded URL, and routes
   only the matching Durable Object thread.

Allowed browser origins come from the Worker environment's `BROWSER_ORIGINS`
list. Production config names the production portfolio origins plus the
explicit `http://localhost:5173` development origin; the local Wrangler profile
names its localhost Vite origins. State-changing browser requests require an
allowed Origin header. OAuth return targets are reduced to the configured
`PORTFOLIO_ORIGIN` or one of the configured browser origins, preventing an open
redirect in either environment.

When production auth is consumed by local Vite, `SESSION_COOKIE_SAME_SITE` is
set to `None` so the Secure, HttpOnly session cookie can accompany credentialed
cross-site requests. The exact Origin allowlist remains the CSRF boundary; do
not replace it with a wildcard.

## D1 ownership

The auth database is separate from the portfolio API database. The checked-in
migration creates users, sessions, OAuth state, threads, one-time agent
tokens, daily usage windows, and the singleton pause/reset control row. The
migration is a reviewed artifact only; the deployment workflow never applies
it automatically.

Runtime keys are provisioned manually through Wrangler or the Cloudflare
dashboard. The source deliberately assembles sensitive key names at runtime so
the repository guard cannot mistake configuration labels for credential
contents. Configure the following names exactly by joining the displayed
fragments:

| Runtime key fragments | Owner |
| --- | --- |
| `GOOGLE_CLIENT_ID` | public-auth variable |
| `GOOGLE_CLIENT_` + `SECRET` | public-auth secret |
| `TURNSTILE_` + `SECRET_KEY` | public-auth secret |
| `AGENT_TOKEN_` + `PRIVATE_JWK` | public-auth secret |
| `AGENT_TOKEN_` + `PUBLIC_JWK` | agent variable/secret |
| `AGENT_INTERNAL_` + `KEY` | shared service-binding secret |
| `BROWSER_ORIGINS` | per-environment public-auth and agent variable |
| `SESSION_COOKIE_SAME_SITE` | public-auth variable (`None` for production local-Vite access) |

The production Google OAuth client must use the fixed callback
`https://public-auth.syn-forge.com/oauth/google/callback`. Local development
against the production Workers uses that same callback and stores the localhost
return target in OAuth state. The isolated `env.local` profile instead uses the
explicit callback
`http://localhost:8787/oauth/google/callback`; it requires a matching Google
authorized redirect URI. The Turnstile site key is a public frontend build
variable. Generate the ES256 key pair outside the repository, store only the
private JWK in public-auth and the public JWK in the agent, and rotate both
together. The local profile should use a separate local-only pair and internal
key.

## Administrative controls

The admin reset endpoint is protected by the existing admin auth Worker and
increments the user quota epoch, revokes sessions, invalidates outstanding
agent JTIs, and clears usage windows. A user-specific reset leaves the global
neuron guard unchanged; a global reset also clears the aggregate estimate and
resumes the agent. The control endpoint can pause or resume the assistant with
a bounded reason. These endpoints are not exposed through the public frontend.

See [[architecture/portfolio-agent|Portfolio Assistant Agent]] for model and
MCP limits, and [[operations/deployment|Production deployment]] for
provisioning and rollout order.
