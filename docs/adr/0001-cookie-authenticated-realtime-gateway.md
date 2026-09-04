---
status: accepted
last_reviewed: 2026-09-04
related:
  - "[[authenticated-identity-blueprint|Universal authenticated identity blueprint]]"
  - "[[architecture/portfolio-public-auth|Public-auth architecture]]"
---

# Cookie-authenticated realtime gateway

Use a cookie-authenticated public gateway for browser realtime connections
instead of placing a reusable bearer token in the WebSocket URL. Query-string
values can reach browser history, referrers, logs, monitoring systems, and
support artifacts even over HTTPS, while the gateway can recheck the session and
resource ownership at upgrade time, forward only a normalized request over a
private channel, and keep the stateful runtime off the browser-facing boundary.
The correlation ID remains diagnostic data rather than a capability. This
choice trades one additional boundary for a smaller browser credential surface
and a clear place to enforce revocation, header stripping, and failure handling.
