/**
 * Issue-reference guard (workflow brainstorm, 2026-07-05 — Fix 2: every piece of work has an issue).
 *
 * Root cause the team hit: ~15 work items lived only in markdown with no GitHub issue, so agents
 * (which read issues, not scattered MD) silently missed or re-did them. This pure check
 * (unit-tested with `node --test`, no deps) lets CI fail a PR that references no issue in its
 * branch name, body, or commits — making "work not on an issue" impossible to merge.
 *
 * `wip/*` freeze branches are exempt (they are mechanical, tracked by the Stage-B process issue).
 */

// `#123` where the # is at a boundary (not `C#`, not `#fff` colors — digits only, not hex letters).
const ISSUE_RE = /(?:^|[^0-9A-Za-z])#(\d+)\b/g;

/** All distinct issue numbers referenced in `text`, in first-seen order. */
export function extractIssueRefs(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text ?? '').matchAll(ISSUE_RE)) {
    const n = Number(m[1]);
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

/**
 * @param {object} o
 * @param {string}   [o.branch]  current branch name (e.g. `fix/358-jest`)
 * @param {string}   [o.prBody]  PR description
 * @param {string[]} [o.commits] commit message headlines/bodies
 * @returns {{ ok: boolean, refs: number[], reason?: string, exempt?: boolean }}
 */
export function checkIssueReference({ branch = '', prBody = '', commits = [] } = {}) {
  if (branch.startsWith('wip/')) {
    return { ok: true, refs: [], exempt: true };
  }
  // A branch named `fix/358-...` / `feat/460-...` / `issue/172-...` counts.
  const refs = [
    ...new Set([
      ...branchRefsFromBranchName(branch),
      ...extractIssueRefs(prBody),
      ...commits.flatMap((c) => extractIssueRefs(c)),
    ]),
  ];
  if (refs.length > 0) return { ok: true, refs };
  return {
    ok: false,
    refs: [],
    reason: 'no GitHub issue referenced in the branch name, PR body, or any commit — '
      + 'open an issue and cite #NNN (or use a wip/ branch for a one-time freeze)',
  };
}

/** Extract a leading issue number from a conventional `type/NNN-slug` branch name. */
function branchRefsFromBranchName(branch) {
  const m = /^[a-z]+\/(\d+)(?:[-_/]|$)/.exec(branch);
  return m ? [Number(m[1])] : [];
}
