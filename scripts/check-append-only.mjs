#!/usr/bin/env node
/**
 * CLI wrapper for the append-only log-header guard (see lib/append-only.mjs).
 * Wire as a CI step on PRs. Exits 1 when a PR removes an existing `## ` header from a protected
 * append-log file (unless the PR title contains `[log-trim]`).
 *
 * Compares the base blob vs HEAD blob per file (NOT a diff) so header moves/edits/fences are handled
 * correctly. Pass the base ref via BASE_REF (default origin/main) and the PR title via PR_TITLE.
 *
 *   PR_TITLE="$(gh pr view --json title -q .title)" BASE_REF="origin/${{ github.base_ref }}" \
 *   node scripts/check-append-only.mjs
 */
import { execFileSync } from 'node:child_process';
import { checkAppendOnlyHeaders } from './lib/append-only.mjs';

const PATHS = ['DONE.md', 'docs/reports/system-impact-report.md'];
const baseRef = process.env.BASE_REF || 'origin/main';
const prTitle = process.env.PR_TITLE || '';

// null when the blob does not exist at that ref (new/deleted file) — distinct from empty string.
const blob = (ref, path) => {
  try { return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' }); }
  catch { return null; }
};

const baseFiles = {};
const headFiles = {};
for (const path of PATHS) {
  baseFiles[path] = blob(baseRef, path);
  headFiles[path] = blob('HEAD', path);
}

const r = checkAppendOnlyHeaders({ baseFiles, headFiles, paths: PATHS, prTitle });
if (r.ok) {
  console.log(r.exempt
    ? '✓ append-only header removals allowed by [log-trim] in the PR title'
    : '✓ append-only log headers intact');
  process.exit(0);
}
console.error(`✗ ${r.reason}`);
for (const v of r.violations) {
  console.error(`  ${v.path}:`);
  for (const h of v.removedHeaders) console.error(`    - ${h}`);
}
process.exit(1);
