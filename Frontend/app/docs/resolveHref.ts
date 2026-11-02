// Where a link or image inside a Markdown file points, the way GitHub reads it: a relative path is
// relative to the file that holds it, and the repository root is the top. Pure, so it tests in isolation.

const REPO_SLUG = 'Slow-Inc/MangaDock';
export const REPO_URL = `https://github.com/${REPO_SLUG}`;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
/** Schemes that can run script or read local files: never a link, never an image source. Applied to trimmed text. */
const UNSAFE_SCHEME = /^(javascript|data|vbscript|file):/i;
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export const isImagePath = (p: string) => IMAGE_EXT.test(p);

/** `./a/../b.png` from `docs/x/y.md` -> `docs/x/b.png`; null when the path climbs out of the repository. */
export function resolveRepoPath(fromFile: string, href: string): string | null {
  const noQuery = href.split(/[?#]/)[0];
  let decoded = noQuery;
  try { decoded = decodeURIComponent(noQuery); } catch { /* keep it as written */ }
  const base = decoded.startsWith('/') ? [] : fromFile.split('/').slice(0, -1);
  const out = [...base];
  for (const seg of decoded.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (out.length === 0) return null; out.pop(); } else out.push(seg);
  }
  return out.length ? out.join('/') : null;
}

export const githubBlobUrl = (repoPath: string, hash = '') => `${REPO_URL}/blob/main/${encodePath(repoPath)}${hash}`;

/**
 * An image that lives in the repository is loaded from GitHub's raw host, not from this server: the deployed
 * function does not carry the repository's binaries (next.config.ts leaves them out of the bundle, #1064), and
 * the repository is public. The branch is `main`, as for the "Edit on GitHub" links.
 */
export const assetUrl = (repoPath: string) => `https://raw.githubusercontent.com/${REPO_SLUG}/main/${encodePath(repoPath)}`;

export type ResolvedLink =
  | { kind: 'hash'; id: string }
  | { kind: 'external'; url: string }
  | { kind: 'doc'; file: string; hash: string }
  | { kind: 'repo'; path: string; url: string }
  | { kind: 'unsafe' };

/**
 * Classifies a link target. `docPaths` are the documents the site shows (a link to one stays inside the
 * site); any other repository path opens on GitHub. A scheme that can run script or read local files is `unsafe`.
 */
export function resolveLink(href: string, fromFile: string, docPaths: ReadonlySet<string>): ResolvedLink {
  const h = href.trim();
  if (UNSAFE_SCHEME.test(h)) return { kind: 'unsafe' };
  if (/^(https?:|mailto:|tel:)/i.test(h)) return { kind: 'external', url: h };
  if (h.startsWith('//')) return { kind: 'external', url: `https:${h}` };
  if (h.startsWith('#')) {
    let id = h.slice(1);
    try { id = decodeURIComponent(id); } catch { /* use it as written */ }
    return { kind: 'hash', id };
  }
  const path = resolveRepoPath(fromFile, h);
  if (!path) return { kind: 'unsafe' };
  const hashAt = h.indexOf('#');
  const hash = hashAt >= 0 ? h.slice(hashAt) : '';
  if (docPaths.has(path)) return { kind: 'doc', file: path, hash };
  return { kind: 'repo', path, url: githubBlobUrl(path, hash) };
}

export type ResolvedImage =
  | { kind: 'remote'; src: string }
  | { kind: 'asset'; src: string; path: string }
  | { kind: 'unsafe' };

/** Where an image should be loaded from, or `unsafe`. A path that is not an image file is not loaded either. */
export function resolveImage(src: string, fromFile: string): ResolvedImage {
  const s = src.trim();
  if (UNSAFE_SCHEME.test(s)) return { kind: 'unsafe' };
  if (/^https?:\/\//i.test(s)) return { kind: 'remote', src: s };
  if (s.startsWith('//')) return { kind: 'remote', src: `https:${s}` };
  const path = resolveRepoPath(fromFile, s);
  if (!path || !isImagePath(path)) return { kind: 'unsafe' };
  return { kind: 'asset', src: assetUrl(path), path };
}
