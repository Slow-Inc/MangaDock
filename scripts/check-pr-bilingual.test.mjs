// Bilingual PR-body gate (structure-only — checks for a real Thai mirror, not translation
// quality; a reviewer still enforces "same depth" per CLAUDE.md). Pure, dependency-free
// (node:test/node:assert only), mirroring the CLAUDE.md "dependency-light, testable in
// isolation" pattern (server/webhook.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countThaiChars, checkBilingualPrBody } from './check-pr-bilingual.mjs';

test('countThaiChars counts Thai-script codepoints only', () => {
  assert.equal(countThaiChars('สวัสดี'), 6);
  assert.equal(countThaiChars('hello'), 0);
  assert.equal(countThaiChars('hello สวัสดี world'), 6);
  assert.equal(countThaiChars(''), 0);
});

test('rejects an English-only PR body', () => {
  const result = checkBilingualPrBody('## Summary\nFixed the bug in the parser.');
  assert.equal(result.ok, false);
});

test('accepts a body with a real Thai mirror section', () => {
  const body = '## Summary\nFixed the bug.\n\n## สรุป\nแก้ไข bug ในตัวแยกวิเคราะห์ข้อมูลเรียบร้อยแล้วครับ ทดสอบผ่านทุกกรณีที่เกี่ยวข้อง';
  const result = checkBilingualPrBody(body);
  assert.equal(result.ok, true);
});

test('rejects a stray Thai word that is not a real mirror (below the threshold)', () => {
  // A body that happens to contain one Thai term (e.g. a product name) must not
  // trivially pass — the gate requires a substantive Thai section, not a token.
  const result = checkBilingualPrBody('## Summary\nUpdated the เมนู label only.');
  assert.equal(result.ok, false);
});

test('rejects a null/empty body', () => {
  assert.equal(checkBilingualPrBody(null).ok, false);
  assert.equal(checkBilingualPrBody('').ok, false);
  assert.equal(checkBilingualPrBody(undefined).ok, false);
});

test('bypasses the check when the title carries [skip-bilingual]', () => {
  const result = checkBilingualPrBody('English only body.', { title: 'fix: typo [skip-bilingual]' });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test('bypasses the check for dependabot PRs', () => {
  const result = checkBilingualPrBody('Bumps foo from 1.0 to 1.1.', { author: 'dependabot[bot]' });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test('failure reason names the missing Thai mirror for a clear CI message', () => {
  const result = checkBilingualPrBody('## Summary\nEnglish only.');
  assert.match(result.reason, /Thai/i);
});
