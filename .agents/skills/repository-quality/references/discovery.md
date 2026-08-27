# Discovery

- Start with `AGENTS.md`, then use `docs/README.md` as the vault map.
- If `graphify-out/graph.json` exists, query it before opening source files. Treat the graph as a locator; source code, configuration, tests, and runtime output remain authoritative.
- If the graph is absent, inspect the relevant manifest, entrypoint, route, schema, or test directly. After code changes, run `pipenv run graphify update .`.
- Use `repository_workflow_status` to check the active root, registrations, dependencies, Graphify output, vault index, and hooks without exposing secrets.
- Read only the narrowest source and documentation context needed for the current task.
