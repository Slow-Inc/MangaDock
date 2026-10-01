#!/usr/bin/env node
/**
 * CLI wrapper for the issue-reference guard (see lib/issue-ref.mjs).
 * Wire as a CI step on PRs (pass the PR body via PR_BODY env). Exits 1 when no GitHub
 * issue is referenced in the branch name, PR body, or any commit on the branch.
 *
 *   PR_BODY="$(gh pr view --json body -q .body)" node scripts/check-issue-ref.mjs
 */
import { execSync } from 'node:child_process';
import { checkIssueReference } from './lib/issue-ref.mjs';

const git = (cmd) => { try { return execSync(`git ${cmd}`, { encoding: 'utf8' }); } catch { return ''; } };

const branch = git('rev-parse --abbrev-ref HEAD').trim();
const prBody = process.env.PR_BODY || '';
const base = process.env.BASE_REF || 'origin/main';
const commits = git(`log ${base}..HEAD --format=%s%n%b`).split('\n').filter(Boolean);

const r = checkIssueReference({ branch, prBody, commits });
if (r.ok) {
  console.log(r.exempt
    ? `✓ ${branch} is exempt from the issue-ref rule (wip/ freeze branch)`
    : `✓ issue reference found: ${r.refs.map((n) => '#' + n).join(', ')}`);
  process.exit(0);
}
console.error(`✗ ${r.reason}`);
process.exit(1);
