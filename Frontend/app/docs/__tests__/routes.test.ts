import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToView, viewToPath, viewTitle, type ViewState } from '../routes.js';

const DOCS = ['Roadmap.md', 'docs/adr/017-x.md', 'docs/prd/ก.md'];
const seg = (p: string) => p.replace(/^\/docs\/?/, '').split('/').filter(Boolean);

describe('docs routes', () => {
  it('round-trips every view through its URL', () => {
    const views: ViewState[] = [
      { type: 'overview' }, { type: 'techstack' }, { type: 'simulations' }, { type: 'gh-branches' },
      { type: 'gh-issues', state: 'open', page: 1 }, { type: 'gh-issue', number: 42 },
      { type: 'gh-pulls', state: 'all', page: 1 }, { type: 'gh-pull', number: 7 },
      ...DOCS.map((file): ViewState => ({ type: 'doc', file })),
    ];
    for (const v of views) assert.deepEqual(pathToView(seg(viewToPath(v)), DOCS), v);
  });

  it('maps a doc file to /docs/doc/<path without .md>', () => {
    assert.equal(viewToPath({ type: 'doc', file: 'docs/adr/017-x.md' }), '/docs/doc/docs/adr/017-x');
  });

  it('rejects unknown, malformed, or unlisted paths', () => {
    for (const s of [['nope'], ['issues', 'abc'], ['issues', '1', '2'], ['techstack', 'x'], ['doc'], ['doc', 'docs', 'missing']])
      assert.equal(pathToView(s, DOCS), null, s.join('/'));
  });

  it('titles every view, falling back for an unknown doc', () => {
    const docs = [{ relativePath: 'Roadmap.md', name: 'Roadmap' }];
    assert.equal(viewTitle({ type: 'overview' }, docs), 'เอกสาร — MangaDock');
    assert.equal(viewTitle({ type: 'doc', file: 'Roadmap.md' }, docs), 'Roadmap — เอกสาร MangaDock');
    assert.equal(viewTitle({ type: 'doc', file: 'gone.md' }, docs), 'เอกสาร — เอกสาร MangaDock');
    assert.equal(viewTitle({ type: 'gh-issue', number: 9 }, docs), 'Issue #9 — เอกสาร MangaDock');
  });
});
