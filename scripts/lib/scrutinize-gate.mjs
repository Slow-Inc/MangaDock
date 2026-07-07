/**
 * Pre-merge scrutinize gate (workflow guard #3 — issue #588).
 *
 * Root cause it fixes: on PR #550 the scrutinize-before-merge rule
 * (`feedback_review_merge_policy`) was followed once on the early slices, but the PR then
 * grew (final wiring + a function swap) and no one re-scrutinized the final state. The rule
 * lived in passive memory, so momentum routed around it. This pure check (unit-tested with
 * `node --test`, no deps — North Star) makes "the verdict covers the FINAL PR state" an
 * enforced CI gate: a PR must carry a machine-readable marker in its body —
 *
 *     <!-- scrutinize verdict=ship commit=<sha> -->
 *
 * and the recorded commit must match the PR's current HEAD (else the verdict is stale — the
 * exact #550 failure). Sibling to `worktree-budget.mjs` / `issue-ref.mjs`; `wip/*` exempt.
 */

const MARKER_RE = /<!--\s*scrutinize\b([^>]*)-->/i;
const VERDICT_RE = /\bverdict\s*=\s*([A-Za-z-]+)/i;
const COMMIT_RE = /\bcommit\s*=\s*([0-9a-fA-F]+)/i;

const MERGEABLE = new Set(['ship', 'fix-then-ship']);
const BLOCKING = new Set(['rework', 'reject']);
const MIN_SHA = 7;

/**
 * @param {object} o
 * @param {string} [o.prBody]  the PR description
 * @param {string} [o.headSha] the PR's current HEAD commit SHA (full 40-char)
 * @param {string} [o.branch]  the PR branch name
 * @returns {{ ok: boolean, verdict?: string|null, commit?: string, reason?: string, exempt?: boolean }}
 */
export function checkScrutinizeVerdict({ prBody = '', headSha = '', branch = '' } = {}) {
  if (branch.startsWith('wip/')) {
    return { ok: true, verdict: null, exempt: true };
  }

  const marker = MARKER_RE.exec(prBody);
  if (!marker) {
    return {
      ok: false,
      reason: 'PR body has no scrutinize verdict marker — run /scrutinize on the FINAL state and '
        + 'record `<!-- scrutinize verdict=ship commit=<HEAD sha> -->` (or use a wip/ branch)',
    };
  }

  const attrs = marker[1];
  const verdict = (VERDICT_RE.exec(attrs)?.[1] || '').toLowerCase();
  const commit = (COMMIT_RE.exec(attrs)?.[1] || '').toLowerCase();

  if (!verdict) {
    return { ok: false, reason: 'scrutinize marker is missing a `verdict=` field' };
  }
  if (!commit) {
    return {
      ok: false,
      reason: 'scrutinize marker is missing a `commit=` field — the commit it covers is what proves '
        + 'the verdict is not stale',
    };
  }
  if (!MERGEABLE.has(verdict) && !BLOCKING.has(verdict)) {
    return { ok: false, reason: `unknown scrutinize verdict "${verdict}" (expected ship/fix-then-ship/rework/reject)` };
  }
  if (BLOCKING.has(verdict)) {
    return { ok: false, verdict, commit, reason: `scrutinize verdict is "${verdict}" — resolve it before merging` };
  }
  if (commit.length < MIN_SHA) {
    return { ok: false, verdict, commit, reason: `recorded commit "${commit}" is too short (need ≥${MIN_SHA} hex chars)` };
  }

  const head = headSha.toLowerCase();
  if (head.length < MIN_SHA) {
    return { ok: false, verdict, commit, reason: 'no HEAD sha provided — cannot verify the verdict is not stale' };
  }
  // The recorded commit must be a prefix of the full HEAD sha. Only this direction: HEAD is
  // always the full 40 chars, so `commit.startsWith(head)` would only ever be true for an empty
  // head — a silent bypass (every commit "fresh"). Intentionally omitted.
  const fresh = head.startsWith(commit);
  if (!fresh) {
    return {
      ok: false,
      verdict,
      commit,
      reason: `scrutinize verdict is stale: it covers ${commit} but HEAD is ${head.slice(0, 12)} — `
        + 're-run /scrutinize on the current state (the #550 failure mode)',
    };
  }

  return { ok: true, verdict, commit };
}
