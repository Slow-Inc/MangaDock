/**
 * Worktree-budget guard (workflow brainstorm, 2026-07-05 — Fix 1: kill the dirty-WIP surface).
 *
 * Root cause the team hit: agents worked directly on the prod branch (`perf`) and let a
 * 312-file uncommitted WIP accumulate, which blocked promotion (Stage B) and hid/lost work.
 * This pure check (unit-tested with `node --test`, no deps — North Star) lets a pre-push hook
 * or CI fail fast when a working tree is over budget or carries build artifacts, so a large
 * dirty tree can never silently re-accumulate.
 *
 * A branch named `wip/*` is the deliberate escape hatch for the one-time freeze of an existing
 * mess — it bypasses the count gate but NOT the artifact gate (junk never belongs in git).
 */

// Committed benchmark evidence lives here and is legitimate (CLAUDE.md benchmark rule).
const BENCHMARKS_DIR = 'docs/reports/benchmarks/';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

/** True if `path` is a build/scratch artifact that must never be committed. */
export function isArtifact(path) {
  const p = path.replace(/\\/g, '/');
  if (p.endsWith('.log')) return true;
  if (p.includes('/_render_dump/') || p.startsWith('_render_dump/')) return true;
  if (p.includes('.playwright-mcp/')) return true;
  if (p.includes('test-results/')) return true;
  // Images are artifacts UNLESS they are committed benchmark evidence.
  if (IMAGE_EXT.test(p)) return !p.includes(BENCHMARKS_DIR);
  return false;
}

/**
 * @param {object} o
 * @param {string[]} [o.tracked]   tracked (modified/added/deleted) paths
 * @param {string[]} [o.untracked] untracked paths (git status `??`)
 * @param {string}   [o.branch]    current branch name
 * @param {number}   [o.maxTracked]
 * @param {number}   [o.maxUntracked]
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkWorktreeBudget({
  tracked = [],
  untracked = [],
  branch = '',
  maxTracked = 25,
  maxUntracked = 50,
} = {}) {
  const violations = [];
  const isWip = branch.startsWith('wip/');

  // Artifact gate — always enforced, even on wip/ branches.
  for (const p of [...tracked, ...untracked]) {
    if (isArtifact(p)) violations.push(`build artifact must not be committed: ${p}`);
  }

  // Count gate — skipped on the wip/ freeze escape hatch.
  if (!isWip) {
    if (tracked.length > maxTracked) {
      violations.push(
        `${tracked.length} tracked files changed (> ${maxTracked}); split into issue-scoped commits or use a wip/ branch`);
    }
    if (untracked.length > maxUntracked) {
      violations.push(
        `${untracked.length} untracked files (> ${maxUntracked}); commit, ignore, or clean them`);
    }
  }

  return { ok: violations.length === 0, violations };
}
