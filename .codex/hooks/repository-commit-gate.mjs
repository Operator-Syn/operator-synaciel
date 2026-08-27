#!/usr/bin/env node

import { readFileSync } from 'node:fs';

try {
  const event = JSON.parse(readFileSync(0, 'utf8'));
  const toolName = event?.tool_name ?? event?.toolName;
  if (toolName !== 'Bash') process.exit(0);

  const rawInput = event?.tool_input ?? event?.toolInput;
  const input = typeof rawInput === 'string' ? { command: rawInput } : rawInput;
  const command = input && typeof input.command === 'string' ? input.command : '';
  if (!/(?:^|[;&|]\s*)git\s+(?:-[^\s]+\s+)*commit\b/i.test(command)) process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Use operator-synaciel-repository: prepare the change or working-tree snapshot, review paths and hashes, then call the approval-gated commit tool. Direct shell git commit is disabled by the repository workflow.',
    },
  }));
} catch {
  // A malformed hook event must not break ordinary read-only tools.
}
