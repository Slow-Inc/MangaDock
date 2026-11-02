import { describe, expect, test } from 'bun:test';
import { assetUrl, githubBlobUrl, resolveImage, resolveLink, resolveRepoPath } from '../resolveHref';

const DOCS = new Set(['docs/adr/001-x.md', 'docs/reports/a.md', 'Roadmap.md']);

describe('resolveRepoPath', () => {
  test('relative to the file that holds the link, like GitHub', () => {
    expect(resolveRepoPath('docs/reports/a.md', './assets/p.png')).toBe('docs/reports/assets/p.png');
    expect(resolveRepoPath('docs/reports/a.md', '../images/p.png')).toBe('docs/images/p.png');
    expect(resolveRepoPath('docs/reports/a.md', 'b.md')).toBe('docs/reports/b.md');
    expect(resolveRepoPath('Roadmap.md', 'Backend/src/x.ts')).toBe('Backend/src/x.ts');
  });
  test('a leading slash is the repository root', () => {
    expect(resolveRepoPath('docs/a/b.md', '/Frontend/x.png')).toBe('Frontend/x.png');
  });
  test('cannot climb out of the repository', () => {
    expect(resolveRepoPath('docs/a.md', '../../etc/passwd')).toBeNull();
    expect(resolveRepoPath('a.md', '..')).toBeNull();
  });
  test('drops ?query and #hash, decodes %20', () => {
    expect(resolveRepoPath('docs/a.md', 'my%20pic.png?raw=1#x')).toBe('docs/my pic.png');
  });
});

describe('resolveLink', () => {
  test('inside the page, the web, a script', () => {
    expect(resolveLink('#setup', 'a.md', DOCS)).toEqual({ kind: 'hash', id: 'setup' });
    expect(resolveLink('https://x.dev/a', 'a.md', DOCS)).toEqual({ kind: 'external', url: 'https://x.dev/a' });
    expect(resolveLink('javascript:alert(1)', 'a.md', DOCS)).toEqual({ kind: 'unsafe' });
    expect(resolveLink(' DATA:text/html,x', 'a.md', DOCS)).toEqual({ kind: 'unsafe' });
    expect(resolveLink('vbscript:msgbox(1)', 'a.md', DOCS)).toEqual({ kind: 'unsafe' });
    expect(resolveLink('file:///etc/passwd', 'a.md', DOCS)).toEqual({ kind: 'unsafe' });
  });
  test('a document of the site stays in the site, with its #hash', () => {
    expect(resolveLink('../adr/001-x.md#ctx', 'docs/reports/a.md', DOCS)).toEqual({ kind: 'doc', file: 'docs/adr/001-x.md', hash: '#ctx' });
  });
  test('any other repository path opens on GitHub', () => {
    expect(resolveLink('../../Backend/src/a b.ts', 'docs/reports/a.md', DOCS)).toEqual({
      kind: 'repo', path: 'Backend/src/a b.ts', url: githubBlobUrl('Backend/src/a b.ts'),
    });
    expect(githubBlobUrl('Backend/src/a b.ts')).toBe('https://github.com/Slow-Inc/MangaDock/blob/main/Backend/src/a%20b.ts');
  });
  test('a path that leaves the repository is not a link', () => {
    expect(resolveLink('../../../x.md', 'docs/a.md', DOCS)).toEqual({ kind: 'unsafe' });
  });
});

describe('resolveImage', () => {
  test('a repository image is loaded from GitHub raw (the deployed function carries no binaries)', () => {
    expect(resolveImage('./assets/p.png', 'docs/reports/a.md')).toEqual({
      kind: 'asset', path: 'docs/reports/assets/p.png', src: assetUrl('docs/reports/assets/p.png'),
    });
    expect(assetUrl('docs/a b.png')).toBe('https://raw.githubusercontent.com/Slow-Inc/MangaDock/main/docs/a%20b.png');
  });
  test('a remote image is remote; anything that could run or read locally is not loaded', () => {
    expect(resolveImage('https://img.shields.io/x.svg', 'a.md')).toEqual({ kind: 'remote', src: 'https://img.shields.io/x.svg' });
    expect(resolveImage('data:image/svg+xml,<svg onload=alert(1)>', 'a.md')).toEqual({ kind: 'unsafe' });
    expect(resolveImage('javascript:1', 'a.md')).toEqual({ kind: 'unsafe' });
    expect(resolveImage('../../../x.png', 'a.md')).toEqual({ kind: 'unsafe' });
  });
  test('a repository path that is not an image is not loaded as one', () => {
    expect(resolveImage('../Backend/.env', 'docs/a.md')).toEqual({ kind: 'unsafe' });
    expect(resolveImage('./notes.md', 'docs/a.md')).toEqual({ kind: 'unsafe' });
  });
});
