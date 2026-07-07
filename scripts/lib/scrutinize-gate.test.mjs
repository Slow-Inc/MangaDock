import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkScrutinizeVerdict } from './scrutinize-gate.mjs';

const HEAD = 'abc1234def5678901234567890abcdef12345678';

test('a fresh ship verdict covering HEAD passes', () => {
  const body = `Some PR.\n<!-- scrutinize verdict=ship commit=${HEAD} -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'ship');
});

test('a fix-then-ship verdict covering HEAD passes', () => {
  const body = `<!-- scrutinize verdict=fix-then-ship commit=${HEAD} -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'fix-then-ship');
});

test('no marker at all fails with an actionable reason', () => {
  const r = checkScrutinizeVerdict({ prBody: 'shipped it, trust me', headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /scrutinize/i);
});

test('a rework verdict blocks the merge', () => {
  const body = `<!-- scrutinize verdict=rework commit=${HEAD} -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /rework/i);
});

test('a reject verdict blocks the merge', () => {
  const body = `<!-- scrutinize verdict=reject commit=${HEAD} -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /reject/i);
});

test('a verdict recorded against an OLD commit is stale (the #550 failure)', () => {
  // verdict covers an earlier commit; the PR then grew — HEAD moved past it.
  const body = `<!-- scrutinize verdict=ship commit=0000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /stale/i);
});

test('a short recorded SHA that is a prefix of HEAD is fresh', () => {
  const body = `<!-- scrutinize verdict=ship commit=abc1234 -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, true);
});

test('a recorded SHA shorter than 7 chars is rejected (too ambiguous)', () => {
  const body = `<!-- scrutinize verdict=ship commit=abc12 -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
});

test('verdict value and key order are case-insensitive / free-order', () => {
  const body = `<!--  scrutinize   commit=${HEAD}   verdict=SHIP  -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'ship');
});

test('a marker missing the commit field fails (cannot prove freshness)', () => {
  const body = `<!-- scrutinize verdict=ship -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
});

test('a marker missing the verdict field fails', () => {
  const body = `<!-- scrutinize commit=${HEAD} -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
});

test('an unknown verdict value fails', () => {
  const body = `<!-- scrutinize verdict=lgtm commit=${HEAD} -->`;
  const r = checkScrutinizeVerdict({ prBody: body, headSha: HEAD, branch: 'feat/1-x' });
  assert.equal(r.ok, false);
});

test('a wip/ freeze branch is exempt', () => {
  const r = checkScrutinizeVerdict({ prBody: 'no verdict here', headSha: HEAD, branch: 'wip/perf-freeze' });
  assert.equal(r.ok, true);
  assert.equal(r.exempt, true);
});
