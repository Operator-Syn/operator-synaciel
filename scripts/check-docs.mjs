import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repoRoot, 'docs');
const advisory = process.argv.includes('--hook');
const errors = [];

const legacyFiles = [
  'migrations/README.md',
  'src/readme',
  'src/assets/readme',
  'src/components/readme.md',
];

async function collectMarkdownFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const info = await lstat(absolutePath);

    if (info.isSymbolicLink()) {
      errors.push(`Vault symlink is not allowed: ${path.relative(repoRoot, absolutePath)}`);
    } else if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files.sort();
}

function stripInlineCode(value) {
  return value.replace(/`[^`\n]*`/g, '');
}

function isExternalTarget(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target) || target.startsWith('#');
}

async function checkMarkdownLink(file, target) {
  const cleanTarget = target.trim().replace(/^<|>$/g, '').split('#', 1)[0];
  if (!cleanTarget || isExternalTarget(cleanTarget)) return;

  const resolvedPath = path.resolve(path.dirname(file), cleanTarget);
  try {
    await lstat(resolvedPath);
  } catch {
    errors.push(`Broken Markdown link in ${path.relative(repoRoot, file)}: ${target}`);
  }
}

async function checkWikiLink(file, target) {
  const cleanTarget = target.trim().split('|', 1)[0].split('#', 1)[0].replace(/\.md$/i, '');
  if (!cleanTarget) return;

  const candidates = [
    path.join(docsRoot, `${cleanTarget}.md`),
    path.join(docsRoot, cleanTarget, 'README.md'),
  ];

  for (const candidate of candidates) {
    try {
      await lstat(candidate);
      return;
    } catch {
      // Try the next documented vault resolution form.
    }
  }

  errors.push(`Broken Obsidian link in ${path.relative(repoRoot, file)}: [[${target}]]`);
}

async function checkFile(file) {
  const contents = stripInlineCode(await readFile(file, 'utf8'));
  const markdownLinks = contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);
  const wikiLinks = contents.matchAll(/\[\[([^\]]+)\]\]/g);

  for (const match of markdownLinks) await checkMarkdownLink(file, match[1]);
  for (const match of wikiLinks) await checkWikiLink(file, match[1]);
}

try {
  await lstat(docsRoot);
  const markdownFiles = await collectMarkdownFiles(docsRoot);

  if (!markdownFiles.some((file) => path.relative(docsRoot, file) === 'README.md')) {
    errors.push('docs/README.md is required as the vault index.');
  }

  for (const relativeFile of legacyFiles) {
    try {
      await lstat(path.join(repoRoot, relativeFile));
      errors.push(`Legacy documentation file remains: ${relativeFile}`);
    } catch {
      // The file was intentionally consolidated into docs/.
    }
  }

  for (const file of markdownFiles) await checkFile(file);
} catch {
  errors.push('docs/ is required as the project documentation vault.');
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  if (!advisory) process.exitCode = 1;
} else {
  console.log('Documentation vault is valid.');
}
