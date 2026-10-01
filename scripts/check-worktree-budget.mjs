#!/usr/bin/env node
/**
 * CLI wrapper for the worktree-budget guard (see lib/worktree-budget.mjs).
 * Wire as a pre-push hook or a CI step. Exits 1 (with actionable violations) when the
 * current working tree is over budget or carries build artifacts.
 *
 *   node scripts/check-worktree-budget.mjs
 */
import { execSync } from 'node:child_process';
import { checkWorktreeBudget } from './lib/worktree-budget.mjs';

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' });

const branch = git('rev-parse --abbrev-ref HEAD').trim();
const tracked = [];
const untracked = [];
for (const line of git('status --porcelain').split('\n').filter(Boolean)) {
  const status = line.slice(0, 2);
  const path = line.slice(3).replace(/^"|"$/g, '');
  (status === '??' ? untracked : tracked).push(path);
}

const r = checkWorktreeBudget({ tracked, untracked, branch });
if (r.ok) {
  console.log(`✓ worktree budget OK — ${tracked.length} tracked, ${untracked.length} untracked (branch ${branch})`);
  process.exit(0);
}
console.error(`✗ worktree-budget violations (branch ${branch}):`);
for (const v of r.violations) console.error(`  - ${v}`);
console.error('\nCommit to an issue-scoped branch, clean artifacts, or use a wip/ branch for a one-time freeze.');
process.exit(1);
