# Commit Workflow Reference

## Bounded change

1. Inspect status and identify the exact target files.
2. Prepare complete file contents with expected hashes.
3. Review the returned paths, hashes, diff, limits, and verification profile.
4. Apply with the exact one-time credential and explicit approval.
5. Run verification and resolve failures before committing.
6. Prepare, edit, and review one subject per applied file.
7. Commit the exact applied set through the local adapter.

## Complete dirty tree

1. Inspect status including every untracked path.
2. Prepare the complete working-tree snapshot.
3. If restricted paths require consent, show only the returned metadata and
   retry with the exact one-time token after explicit approval.
4. Reprepare if the snapshot changes.
5. Run the narrowest verification profile.
6. Provide one reviewed subject for each reviewed path.
7. Commit sequentially and report partial progress if a hook or Git operation
   fails.

If the adapter is unavailable, report the missing capability. Use native Git
only when repository policy and explicit user authorization allow it.
