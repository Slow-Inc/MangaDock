// URL ↔ view mapping for the docs site. Dependency-free so it tests in isolation.
//
//   /docs                     overview
//   /docs/techstack           tech stack
//   /docs/simulations         simulations
//   /docs/branches            GitHub branches
//   /docs/issues[/123]        GitHub issue list / detail
//   /docs/pulls[/45]          GitHub PR list / detail
//   /docs/doc/<path>          markdown file; <path> = relativePath minus ".md"
//                             e.g. docs/adr/017-x.md → /docs/doc/docs/adr/017-x

export type ViewState =
  | { type: 'overview' }
  | { type: 'techstack' }
  | { type: 'simulations' }
  | { type: 'doc'; file: string }
  | { type: 'gh-issues'; state: 'open' | 'closed' | 'all'; page: number }
  | { type: 'gh-issue'; number: number }
  | { type: 'gh-pulls'; state: 'open' | 'closed' | 'all'; page: number }
  | { type: 'gh-pull'; number: number }
  | { type: 'gh-branches' };

export const DOCS_BASE = '/docs';

export function viewToPath(v: ViewState): string {
  switch (v.type) {
    case 'overview': return DOCS_BASE;
    case 'techstack': return `${DOCS_BASE}/techstack`;
    case 'simulations': return `${DOCS_BASE}/simulations`;
    case 'gh-branches': return `${DOCS_BASE}/branches`;
    case 'gh-issues': return `${DOCS_BASE}/issues`;
    case 'gh-issue': return `${DOCS_BASE}/issues/${v.number}`;
    case 'gh-pulls': return `${DOCS_BASE}/pulls`;
    case 'gh-pull': return `${DOCS_BASE}/pulls/${v.number}`;
    case 'doc':
      return `${DOCS_BASE}/doc/${v.file.replace(/\.md$/, '').split('/').map(encodeURIComponent).join('/')}`;
  }
}

/** Tab title for a view. `docs` only needs each document's path and name. */
export function viewTitle(view: ViewState, docs: readonly { relativePath: string; name: string }[]): string {
  const base = 'เอกสาร MangaDock';
  switch (view.type) {
    case 'overview': return 'เอกสาร — MangaDock';
    case 'doc': return `${docs.find(f => f.relativePath === view.file)?.name ?? 'เอกสาร'} — ${base}`;
    case 'techstack': return `Tech Stack — ${base}`;
    case 'simulations': return `Simulations — ${base}`;
    case 'gh-branches': return `Branches — ${base}`;
    case 'gh-issues': return `Issues — ${base}`;
    case 'gh-issue': return `Issue #${view.number} — ${base}`;
    case 'gh-pulls': return `Pull Requests — ${base}`;
    case 'gh-pull': return `PR #${view.number} — ${base}`;
  }
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function parseNumber(s: string | undefined): number | null {
  return s !== undefined && /^\d+$/.test(s) ? Number(s) : null;
}

/** Returns null when the URL maps to nothing (caller shows 404). */
export function pathToView(segments: string[], docPaths: readonly string[]): ViewState | null {
  const [head, ...rest] = segments.map(safeDecode);
  if (head === undefined) return { type: 'overview' };

  switch (head) {
    case 'techstack': return rest.length ? null : { type: 'techstack' };
    case 'simulations': return rest.length ? null : { type: 'simulations' };
    case 'branches': return rest.length ? null : { type: 'gh-branches' };
    case 'issues':
    case 'pulls': {
      const list = head === 'issues' ? 'gh-issues' : 'gh-pulls';
      if (rest.length === 0) return { type: list, state: head === 'issues' ? 'open' : 'all', page: 1 };
      const n = rest.length === 1 ? parseNumber(rest[0]) : null;
      if (n === null) return null;
      return head === 'issues' ? { type: 'gh-issue', number: n } : { type: 'gh-pull', number: n };
    }
    case 'doc': {
      if (rest.length === 0) return null;
      const file = `${rest.join('/')}.md`;
      return docPaths.includes(file) ? { type: 'doc', file } : null;
    }
    default: return null;
  }
}
