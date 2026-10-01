import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectUnitTestFiles } from './frontend-unit-tests.mjs';

test('a Playwright *.e2e.test.ts is not a unit test', () => {
  assert.deepEqual(selectUnitTestFiles(['app/docs/__tests__/mermaid.e2e.test.ts']), []);
});

test('an *.integration.test.ts (needs a live :4000 server) is not a unit test', () => {
  assert.deepEqual(selectUnitTestFiles(['app/docs/__tests__/docs.integration.test.ts']), []);
});

test('files that are not *.test.ts are not tests at all', () => {
  assert.deepEqual(selectUnitTestFiles(['app/lib/imgUrl.ts', 'app/page.tsx', 'lib/README.md']), []);
});

// The trap that rules out the tempting one-liner "drop anything with an extra dot"
// (`-not -name '*.*.test.ts'`): PageRenderer.memo.test.ts is a real unit test whose extra
// dot is descriptive, not a runner qualifier. Only the known non-unit qualifiers exclude.
test('a descriptive extra dot does not make it a non-unit test', () => {
  const files = ['app/components/__tests__/PageRenderer.memo.test.ts'];
  assert.deepEqual(selectUnitTestFiles(files), files);
});

test('a mixed tree keeps only the unit tests, in input order', () => {
  assert.deepEqual(
    selectUnitTestFiles([
      'app/lib/imgUrl.test.ts',
      'app/docs/__tests__/mermaid.e2e.test.ts',
      'app/components/__tests__/PageRenderer.memo.test.ts',
      'app/docs/__tests__/docs.integration.test.ts',
      'app/lib/imgUrl.ts',
    ]),
    ['app/lib/imgUrl.test.ts', 'app/components/__tests__/PageRenderer.memo.test.ts'],
  );
});
