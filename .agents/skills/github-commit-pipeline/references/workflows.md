# Local Commit Workflow

## Reviewed change

1. Inspect status, including untracked paths.
2. Identify the exact target paths and review their full diff.
3. Run the narrowest fixed verification that covers the change.
4. Stage only the reviewed paths.
5. Write a clear sentence-style commit subject.
6. Commit with the hooks active; do not bypass them.
7. Report the commit ID, hook status, verification results, and any partial
   progress.

## Dirty tree

1. Inspect status including every untracked path.
2. Separate the requested paths from unrelated dirty work; never sweep
   unrelated changes into the commit.
3. Review the diffs and run verification for the requested change.
4. Stage and commit only the reviewed paths.

If a check or hook fails, stop and report it. Do not amend published history,
force a push, or bypass a hook to get past the failure.
