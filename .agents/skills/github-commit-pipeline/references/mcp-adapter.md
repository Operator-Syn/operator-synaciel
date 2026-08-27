# MCP Adapter Reference

Map tools by behavior rather than assuming a server name or schema.

## Capability map

| Capability | Purpose |
| --- | --- |
| Bounded preparation | Validate a planned file change and return a reviewable diff, hashes, and one-time apply credentials without writing. |
| Bounded apply | Recheck exact hashes, apply the prepared content atomically, and return final hashes. |
| Verification | Run only a named allowlisted repository profile. |
| Working-tree preparation | Snapshot every visible dirty path, including untracked files, deletions, binary sizes, hashes, and diff. |
| Working-tree commit | Recheck the reviewed snapshot and commit one reviewed path at a time. |
| Applied subject preparation | Recheck applied files and suggest one subject per file. |
| Applied-file commit | Commit the exact applied file set one path at a time. |

## Invariants

- Operation IDs, plan IDs, approval hashes, expected hashes, and consent tokens
  are opaque, short-lived, and must be copied exactly.
- Preparation is read-only. Apply requires the exact one-time credential,
  explicit approval, and a complete expected-hash map.
- Any changed path, status, or content invalidates the operation and requires
  fresh preparation.
- Commit requests require exact path coverage with no duplicates or omissions.
- Commit subjects are one sentence ending in a period. Any following lines
  must be valid `Co-authored-by` trailers when the adapter permits trailers.
- Verification accepts named profiles and fixed checks only. It must not accept
  arbitrary shell text, remote URLs, credentials, deployment, or migration
  application commands.
- Local commits never imply permission to push, publish, merge, release, or
  deploy.
