#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const WRAPPED_SHELLS = new Set(['bash', 'dash', 'ksh', 'sh', 'zsh']);
const COMMAND_WRAPPERS = new Set(['command', 'eval', 'exec']);
const GIT_GLOBAL_OPTIONS_WITH_VALUES = new Set([
  '-C',
  '--config-env',
  '--exec-path',
  '--git-dir',
  '--namespace',
  '--super-prefix',
  '--work-tree',
  '-c',
]);

function basename(value) {
  return value.split('/').at(-1)?.replace(/\.exe$/i, '').toLowerCase() ?? '';
}

function tokenizeShell(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;

  const pushWord = () => {
    if (current) tokens.push({ kind: 'word', value: current });
    current = '';
  };
  const pushSeparator = () => {
    pushWord();
    tokens.push({ kind: 'separator', value: 'separator' });
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (quote === "'") {
      if (character === "'") quote = null;
      else current += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = null;
      else if (character === '\\') escaped = true;
      else current += character;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '#' && !current && (index === 0 || /\s/.test(command[index - 1]))) {
      while (index < command.length && command[index] !== '\n') index += 1;
      index -= 1;
      continue;
    }
    if (character === ';' || character === '\n') {
      pushSeparator();
      continue;
    }
    if (character === '&' || character === '|') {
      pushSeparator();
      if (command[index + 1] === character) index += 1;
      continue;
    }
    if (/\s/.test(character)) {
      pushWord();
      continue;
    }
    current += character;
  }
  pushWord();
  return tokens;
}

function commandSegments(tokens) {
  const segments = [];
  let segment = [];
  for (const token of tokens) {
    if (token.kind === 'separator') {
      if (segment.length) segments.push(segment);
      segment = [];
    } else {
      segment.push(token.value);
    }
  }
  if (segment.length) segments.push(segment);
  return segments;
}

function isAssignment(word) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(word);
}

function shellCommand(tokens) {
  for (let index = 1; index < tokens.length - 1; index += 1) {
    const option = tokens[index];
    if (option === '--command' || option === '-c' || /^-[^-]*c/.test(option)) {
      return containsGitCommitInvocation(tokens[index + 1]);
    }
  }
  return false;
}

function gitCommand(tokens) {
  let index = 1;
  while (index < tokens.length) {
    const option = tokens[index];
    if (option === '--') return false;
    if (!option.startsWith('-')) return option.toLowerCase() === 'commit';
    index += 1;
    if (GIT_GLOBAL_OPTIONS_WITH_VALUES.has(option) && index < tokens.length) index += 1;
  }
  return false;
}

function wrappedCommand(tokens) {
  const command = basename(tokens[0] ?? '');
  if (WRAPPED_SHELLS.has(command)) return shellCommand(tokens);
  if (command === 'env') {
    let index = 1;
    while (index < tokens.length && (isAssignment(tokens[index]) || tokens[index].startsWith('-'))) {
      index += 1;
    }
    return index < tokens.length && commandSegmentInvokesCommit(tokens.slice(index));
  }
  if (command === 'eval') return containsGitCommitInvocation(tokens.slice(1).join(' '));
  if (COMMAND_WRAPPERS.has(command)) {
    let index = 1;
    while (index < tokens.length && tokens[index].startsWith('-')) index += 1;
    return index < tokens.length && commandSegmentInvokesCommit(tokens.slice(index));
  }
  return false;
}

function commandSegmentInvokesCommit(tokens) {
  if (!tokens.length) return false;
  const command = basename(tokens[0]);
  if (command === 'git') return gitCommand(tokens);
  return wrappedCommand(tokens);
}

export function containsGitCommitInvocation(command) {
  if (typeof command !== 'string' || !command.trim()) return false;
  return commandSegments(tokenizeShell(command)).some(commandSegmentInvokesCommit);
}

export function commitGateDecision(event) {
  const toolName = event?.tool_name ?? event?.toolName;
  if (toolName !== 'Bash') return null;

  const rawInput = event?.tool_input ?? event?.toolInput;
  const input = typeof rawInput === 'string' ? { command: rawInput } : rawInput;
  const command = input && typeof input.command === 'string' ? input.command : '';
  if (!containsGitCommitInvocation(command)) return null;

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Use operator-synaciel-repository: prepare the change or working-tree snapshot, review paths and hashes, then call the approval-gated commit tool. Direct shell git commit is disabled by the repository workflow.',
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const event = JSON.parse(readFileSync(0, 'utf8'));
    const decision = commitGateDecision(event);
    if (decision) process.stdout.write(JSON.stringify(decision));
  } catch {
    // A malformed hook event must not break ordinary read-only tools.
  }
}
