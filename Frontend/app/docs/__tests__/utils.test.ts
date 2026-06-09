import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { labelFg, relativeDate, CATEGORY_LABELS } from '../utils.js';

// ── labelFg ─────────────────────────────────────────────────────────────────

describe('labelFg', () => {
  it('returns dark text on white background', () => {
    assert.equal(labelFg('ffffff'), '#08090d');
  });

  it('returns dark text on bright yellow', () => {
    assert.equal(labelFg('ffff00'), '#08090d');
  });

  it('returns light text on black background', () => {
    assert.equal(labelFg('000000'), '#f8f9fb');
  });

  it('returns light text on dark red', () => {
    assert.equal(labelFg('8b0000'), '#f8f9fb');
  });

  it('returns light text on indigo (GitHub default)', () => {
    // indigo-600 #4f46e5 — luminance ≈ 0.08, well below 0.4
    assert.equal(labelFg('4f46e5'), '#f8f9fb');
  });
});

// ── relativeDate ─────────────────────────────────────────────────────────────

describe('relativeDate', () => {
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString();

  it('returns วันนี้ for today', () => {
    assert.equal(relativeDate(new Date(now - 3600000).toISOString()), 'วันนี้');
  });

  it('returns เมื่อวาน for 1 day ago', () => {
    assert.equal(relativeDate(daysAgo(1)), 'เมื่อวาน');
  });

  it('returns N วันที่แล้ว for 3 days ago', () => {
    assert.equal(relativeDate(daysAgo(3)), '3 วันที่แล้ว');
  });

  it('returns N สัปดาห์ที่แล้ว for 2 weeks ago', () => {
    assert.equal(relativeDate(daysAgo(14)), '2 สัปดาห์ที่แล้ว');
  });

  it('returns N เดือนที่แล้ว for 60 days ago', () => {
    assert.equal(relativeDate(daysAgo(60)), '2 เดือนที่แล้ว');
  });

  it('returns N ปีที่แล้ว for 400 days ago', () => {
    assert.equal(relativeDate(daysAgo(400)), '1 ปีที่แล้ว');
  });
});

// ── CATEGORY_LABELS ──────────────────────────────────────────────────────────

describe('CATEGORY_LABELS', () => {
  it('maps docs/agents to Agent Guides', () => {
    assert.equal(CATEGORY_LABELS['docs/agents'], 'Agent Guides');
  });

  it('maps docs/prd to Product Requirements', () => {
    assert.equal(CATEGORY_LABELS['docs/prd'], 'Product Requirements');
  });

  it('maps root to หลัก', () => {
    assert.equal(CATEGORY_LABELS['root'], 'หลัก');
  });
});
