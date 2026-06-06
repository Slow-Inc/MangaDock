/**
 * Integration tests — require dev server running on :4000
 * Run: npx tsx --test app/docs/__tests__/docs.integration.test.ts
 *
 * These verify the SSR output of the docs page (collectMdFiles → DocsClient)
 * and are the automation counterpart of the MCP Playwright E2E session.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4000';

async function fetchDocsHtml(): Promise<string> {
  const res = await fetch(`${BASE}/docs`);
  assert.equal(res.status, 200, 'GET /docs should return 200');
  return res.text();
}

describe('docs page — SSR output', () => {
  it('returns HTTP 200', async () => {
    const res = await fetch(`${BASE}/docs`);
    assert.equal(res.status, 200);
  });

  it('includes page title', async () => {
    const html = await fetchDocsHtml();
    assert.ok(html.includes('เอกสาร — MangaDock'), 'page title missing from HTML');
  });

  it('sidebar: หลัก category is rendered', async () => {
    const html = await fetchDocsHtml();
    assert.ok(html.includes('หลัก'), '"หลัก" category label missing');
  });

  it('sidebar: Agent Guides category is rendered', async () => {
    const html = await fetchDocsHtml();
    assert.ok(html.includes('Agent Guides'), '"Agent Guides" category label missing');
  });

  it('sidebar: Product Requirements category is rendered', async () => {
    const html = await fetchDocsHtml();
    assert.ok(html.includes('Product Requirements'), '"Product Requirements" category label missing');
  });

  it('sidebar: r2-global-asset-distribution PRD doc is listed', async () => {
    const html = await fetchDocsHtml();
    assert.ok(
      html.includes('r2-global-asset-distribution'),
      'PRD doc missing — check CATEGORY_LABELS["docs/prd"]',
    );
  });

  it('sidebar: issue-tracker doc is listed under Agent Guides', async () => {
    const html = await fetchDocsHtml();
    assert.ok(html.includes('issue-tracker'), 'issue-tracker doc missing');
  });
});
