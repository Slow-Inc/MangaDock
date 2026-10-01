import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWorktreeBudget, isArtifact } from './worktree-budget.mjs';

test('a small clean change passes', () => {
  const r = checkWorktreeBudget({ tracked: ['Backend/src/a.ts', 'Backend/src/b.ts'], untracked: [], branch: 'fix/12-thing' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test('too many tracked-modified files fails with a count violation', () => {
  const tracked = Array.from({ length: 30 }, (_, i) => `src/f${i}.ts`);
  const r = checkWorktreeBudget({ tracked, untracked: [], branch: 'fix/12-thing', maxTracked: 25 });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => /tracked/i.test(v) && /30/.test(v)));
});

test('too many untracked files fails', () => {
  const untracked = Array.from({ length: 60 }, (_, i) => `scratch/u${i}.tmp`);
  const r = checkWorktreeBudget({ tracked: [], untracked, branch: 'fix/12-thing', maxUntracked: 50 });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => /untracked/i.test(v)));
});

test('a wip/ branch bypasses the count gate (freeze escape hatch)', () => {
  const tracked = Array.from({ length: 312 }, (_, i) => `src/f${i}.ts`);
  const r = checkWorktreeBudget({ tracked, untracked: [], branch: 'wip/perf-freeze', maxTracked: 25 });
  assert.equal(r.ok, true);
});

test('build artifacts are always flagged, even on a wip/ branch and even when small', () => {
  const r = checkWorktreeBudget({
    tracked: ['MIT/_phase0_worker.log'],
    untracked: ['Frontend/test-results/run.json', 'MIT/_render_dump/p1.png'],
    branch: 'wip/perf-freeze',
  });
  assert.equal(r.ok, false);
  // one violation per artifact
  assert.ok(r.violations.some((v) => /_phase0_worker\.log/.test(v)));
  assert.ok(r.violations.some((v) => /test-results/.test(v)));
  assert.ok(r.violations.some((v) => /_render_dump/.test(v)));
});

test('a committed benchmark PNG under docs/reports/benchmarks is NOT an artifact', () => {
  assert.equal(isArtifact('docs/reports/benchmarks/2026-07-05-topic.png'), false);
  const r = checkWorktreeBudget({ tracked: ['docs/reports/benchmarks/2026-07-05-topic.png'], untracked: [], branch: 'fix/12' });
  assert.equal(r.ok, true);
});

test('a stray PNG outside the benchmarks dir IS an artifact', () => {
  assert.equal(isArtifact('screenshot.png'), true);
  assert.equal(isArtifact('MIT/out.png'), true);
});

test('isArtifact recognizes logs, dumps, playwright, test-results', () => {
  assert.equal(isArtifact('x.log'), true);
  assert.equal(isArtifact('a/_render_dump/b.npz'), true);
  assert.equal(isArtifact('.playwright-mcp/trace.zip'), true);
  assert.equal(isArtifact('Frontend/test-results/x'), true);
  assert.equal(isArtifact('Backend/src/real-code.ts'), false);
});
