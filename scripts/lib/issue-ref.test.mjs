import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractIssueRefs, checkIssueReference } from './issue-ref.mjs';

test('extractIssueRefs pulls all #NNN', () => {
  assert.deepEqual(extractIssueRefs('Closes #12 and also #34.'), [12, 34]);
});

test('extractIssueRefs ignores non-issue hashes (C#, colors, bare #)', () => {
  assert.deepEqual(extractIssueRefs('use C# and color #fff and a bare # sign'), []);
});

test('extractIssueRefs dedupes', () => {
  assert.deepEqual(extractIssueRefs('#7 then #7 again'), [7]);
});

test('a branch named after an issue passes', () => {
  const r = checkIssueReference({ branch: 'fix/358-jest-skiplist', prBody: '', commits: [] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.refs, [358]);
});

test('an issue ref in the PR body passes', () => {
  const r = checkIssueReference({ branch: 'random-name', prBody: 'This closes #42.', commits: [] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.refs, [42]);
});

test('an issue ref in a commit message passes', () => {
  const r = checkIssueReference({ branch: 'random', prBody: 'no ref', commits: ['feat: thing (#99)'] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.refs, [99]);
});

test('no reference anywhere fails with an actionable reason', () => {
  const r = checkIssueReference({ branch: 'random-name', prBody: 'did stuff', commits: ['wip'] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /issue/i);
});

test('a wip/ freeze branch is exempt (tracked by the Stage-B process issue)', () => {
  const r = checkIssueReference({ branch: 'wip/perf-freeze', prBody: '', commits: [] });
  assert.equal(r.ok, true);
  assert.equal(r.exempt, true);
});
