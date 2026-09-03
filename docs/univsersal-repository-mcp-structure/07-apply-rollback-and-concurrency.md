---
title: Repository MCP Apply Rollback and Concurrency
aliases:
  - MCP mutation safety
  - Repository change rollback
tags:
  - mcp
  - concurrency
  - rollback
  - atomicity
role: explanation
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/06-change-preparation-and-diff|Change preparation]]"
---

# Apply, Rollback, and Concurrency

## Apply sequence

`apply_repository_change` accepts only a prepared plan, matching apply token,
matching review hash, and `approve: true`.

1. Recheck plan/receipt validity and expiry.
2. Acquire the per-checkout mutation lock.
3. Re-read every file and compare its current hash with the prepared hash.
4. If any collaborator or tracking state changed, return a conflict without
   mutation and point to `read_repository_files`.
5. Atomically write creates/updates; move deletes to a unique same-directory
   tombstone.
6. Re-read every final path and verify the expected final hash or deletion.
7. Remove tombstones only after all final checks pass.
8. Register a short-lived applied operation for the commit pipeline.
9. Optionally run the selected fixed verification profile.
10. Store an idempotent receipt, remove the plan, and invalidate status/verification caches.

## Rollback

Any failure after mutation restores captured files in reverse order, restores
quarantined deletions, removes newly created paths, and returns
`APPLY_ROLLED_BACK` with a retryable next action. This is operation-level
rollback;
it does not delete directories recursively or use operating-system trash.

## Locking and retention

`withMutationLock` serializes same-process requests and coordinates other
processes through a lock under the Git common directory. It records PID,
token, timestamp, and canonical checkout root. A lock is reclaimed only when its
owner is gone or the lease is demonstrably stale; acquisition waits up to 120
seconds.

Plans and applied operations expire after 30 minutes and are pruned by count and
a shared 64 MiB retained-review budget. Replaying a completed apply with the
same plan ID, apply token, and review hash returns the original receipt instead of reapplying.

Related:
[[univsersal-repository-mcp-structure/08-verification-and-status|verification and status]] ·
[[univsersal-repository-mcp-structure/09-commit-pipeline-and-hooks|commit handoff]]
