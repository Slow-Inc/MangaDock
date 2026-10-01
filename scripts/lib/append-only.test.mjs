import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAppendOnlyHeaders, checkAppendOnlyHeaders } from './append-only.mjs';

// ---- extractAppendOnlyHeaders ----

test('extracts level-2 headers in order', () => {
  assert.deepEqual(extractAppendOnlyHeaders('## A\ntext\n## B\n'), ['## A', '## B']);
});

test('ignores ## inside a fenced code block', () => {
  const md = '## Real\n```\n## not a header\n```\n## Also real';
  assert.deepEqual(extractAppendOnlyHeaders(md), ['## Real', '## Also real']);
});

test('normalizes CRLF and trailing whitespace so they are not spurious differences', () => {
  assert.deepEqual(extractAppendOnlyHeaders('## A  \r\n## B\r\n'), ['## A', '## B']);
});

test('does not treat ### (h3) or #(h1) as an append-log header', () => {
  assert.deepEqual(extractAppendOnlyHeaders('# Title\n### sub\n## Entry'), ['## Entry']);
});

// ---- checkAppendOnlyHeaders ----

const opts = (base, head, extra = {}) => ({
  baseFiles: { 'DONE.md': base },
  headFiles: { 'DONE.md': head },
  paths: ['DONE.md'],
  ...extra,
});

test('removing an existing header fails', () => {
  const r = checkAppendOnlyHeaders(opts('## Keep\n## Drop\n', '## Keep\n'));
  assert.equal(r.ok, false);
  assert.match(r.reason, /log-trim/);
  assert.deepEqual(r.violations[0].removedHeaders, ['## Drop']);
});

test('adding a new header (real append) passes', () => {
  const r = checkAppendOnlyHeaders(opts('## Old\n', '## New\n## Old\n'));
  assert.equal(r.ok, true);
});

test('moving a header within the file passes (multiset unchanged)', () => {
  const r = checkAppendOnlyHeaders(opts('## A\n## B\n', '## B\n## A\n'));
  assert.equal(r.ok, true);
});

test('editing/renaming a header fails (old removed) unless curated', () => {
  const r = checkAppendOnlyHeaders(opts('## Fix tpyo\n', '## Fix typo\n'));
  assert.equal(r.ok, false);
});

test('a code-fence ## that is dropped does not count as a removed header', () => {
  const r = checkAppendOnlyHeaders(opts('## Real\n```\n## fenced\n```\n', '## Real\n'));
  assert.equal(r.ok, true);
});

test('CRLF vs LF only difference is not a violation', () => {
  const r = checkAppendOnlyHeaders(opts('## A\n## B\n', '## A\r\n## B\r\n'));
  assert.equal(r.ok, true);
});

test('a duplicate header collapsing from 2 to 1 fails', () => {
  const r = checkAppendOnlyHeaders(opts('## Dup\nx\n## Dup\n', '## Dup\n'));
  assert.equal(r.ok, false);
});

test('[log-trim] in the PR title exempts an intentional curation', () => {
  const r = checkAppendOnlyHeaders(opts('## Keep\n## Drop\n', '## Keep\n', { prTitle: 'docs: trim old log [log-trim]' }));
  assert.equal(r.ok, true);
  assert.equal(r.exempt, true);
});

test('a deleted file (head null) reports all its headers removed', () => {
  const r = checkAppendOnlyHeaders({ baseFiles: { 'DONE.md': '## A\n## B\n' }, headFiles: { 'DONE.md': null }, paths: ['DONE.md'] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations[0].removedHeaders.sort(), ['## A', '## B']);
});

test('an untouched file passes (base == head)', () => {
  const r = checkAppendOnlyHeaders(opts('## A\n## B\n', '## A\n## B\n'));
  assert.equal(r.ok, true);
});

test('a file absent from base (new file) is not checked', () => {
  const r = checkAppendOnlyHeaders({ baseFiles: { 'DONE.md': null }, headFiles: { 'DONE.md': '## A\n' }, paths: ['DONE.md'] });
  assert.equal(r.ok, true);
});
