#!/usr/bin/env node
/**
 * CLI wrapper for the pre-merge scrutinize gate (see lib/scrutinize-gate.mjs).
 * Wire as a CI step on PRs (pass the PR body via PR_BODY env). Exits 1 unless the PR body
 * carries a fresh, acceptable scrutinize verdict covering the current HEAD.
 *
 *   PR_BODY="$(gh pr view --json body -q .body)" \
 *   HEAD_SHA="$(git rev-parse HEAD)" node scripts/check-scrutinize.mjs
 */
import { execSync } from 'node:child_process';
import { checkScrutinizeVerdict } from './lib/scrutinize-gate.mjs';

const git = (cmd) => { try { return execSync(`git ${cmd}`, { encoding: 'utf8' }); } catch { return ''; } };

const branch = git('rev-parse --abbrev-ref HEAD').trim();
const prBody = process.env.PR_BODY || '';
const headSha = (process.env.HEAD_SHA || git('rev-parse HEAD')).trim();

const r = checkScrutinizeVerdict({ prBody, headSha, branch });
if (r.ok) {
  console.log(r.exempt
    ? `✓ ${branch} is exempt from the scrutinize gate (wip/ freeze branch)`
    : `✓ scrutinize verdict "${r.verdict}" covers HEAD ${headSha.slice(0, 12)}`);
  process.exit(0);
}
console.error(`✗ ${r.reason}`);
process.exit(1);
