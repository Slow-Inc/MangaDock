/**
 * Append-only log-header guard (workflow guard #4 — issue #610).
 *
 * Root cause it fixes: a "stale-base clobber" (#553 → remediated in #608). A PR branched off an old
 * base and its diff silently DROPPED newer `## ` entries that had already been merged into the shared
 * append-log files (`DONE.md`, `docs/reports/system-impact-report.md`). It passed CI + review +
 * auto-merge because nothing conflicted textually. The other three guards don't catch this class.
 *
 * Design (3-agent brainstorm, codex's refinement): compare the MULTISET of `## ` section headers in
 * the base blob vs the PR/head blob — NOT unified-diff parsing. Blob comparison is robust to header
 * MOVES (pass), code-fenced `## ` (ignored), CRLF/LF, and duplicate headers, and it sidesteps the
 * `git diff origin/main...HEAD` three-dot trap (which compares merge-base→HEAD and would miss content
 * main added after the branch point — the very clobber scenario). A removed header is a violation
 * unless the PR title carries `[log-trim]` (intentional curation — mirrors the `wip/` exemption).
 * Pure + unit-tested with `node --test`, no deps (North Star). Sibling to the other three guards.
 */

const DEFAULT_PATHS = ['DONE.md', 'docs/reports/system-impact-report.md'];
const FENCE_RE = /^[ \t]{0,3}(```+|~~~+)/;
const H2_RE = /^## [^\r\n]*\S[ \t]*$/;

/**
 * Level-2 (`## `) section headers in `text`, in first-seen order, ignoring fenced code blocks.
 * CRLF and trailing whitespace are normalized so they never look like a header change.
 * @param {string} text
 * @returns {string[]}
 */
export function extractAppendOnlyHeaders(text) {
  const out = [];
  let inFence = false;
  let fenceChar = '';
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/[ \t]+$/g, '');
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const ch = fence[1][0];
      if (!inFence) { inFence = true; fenceChar = ch; }
      else if (ch === fenceChar) { inFence = false; fenceChar = ''; }
      continue;
    }
    if (!inFence && H2_RE.test(line)) out.push(line);
  }
  return out;
}

function counts(headers) {
  const m = new Map();
  for (const h of headers) m.set(h, (m.get(h) ?? 0) + 1);
  return m;
}

/**
 * @param {object} o
 * @param {Record<string,string|null|undefined>} [o.baseFiles] base-blob text keyed by repo path (null = absent)
 * @param {Record<string,string|null|undefined>} [o.headFiles] PR/head-blob text keyed by repo path (null = deleted)
 * @param {string[]} [o.paths]        protected append-log paths
 * @param {string}   [o.prTitle]      PR title (checked for the escape marker)
 * @param {string}   [o.escapeMarker] title marker that exempts intentional curation
 * @returns {{ ok: boolean, exempt?: boolean, violations: {path:string, removedHeaders:string[]}[], reason?: string }}
 */
export function checkAppendOnlyHeaders({
  baseFiles = {},
  headFiles = {},
  paths = DEFAULT_PATHS,
  prTitle = '',
  escapeMarker = '[log-trim]',
} = {}) {
  const violations = [];
  for (const path of paths) {
    const baseText = baseFiles[path];
    if (baseText == null) continue; // file did not exist at base → nothing to protect (new file)
    const baseCounts = counts(extractAppendOnlyHeaders(baseText));
    const headCounts = counts(extractAppendOnlyHeaders(headFiles[path] ?? ''));
    const removedHeaders = [];
    for (const [header, baseCount] of baseCounts) {
      const headCount = headCounts.get(header) ?? 0;
      for (let i = headCount; i < baseCount; i += 1) removedHeaders.push(header);
    }
    if (removedHeaders.length > 0) violations.push({ path, removedHeaders });
  }

  const exempt = prTitle.includes(escapeMarker);
  if (violations.length === 0 || exempt) {
    return { ok: true, exempt, violations };
  }
  return {
    ok: false,
    violations,
    reason: `append-only log headers were removed — a stale-base clobber drops merged entries. `
      + `Restore them, or add ${escapeMarker} to the PR title if the removal is intentional curation.`,
  };
}
