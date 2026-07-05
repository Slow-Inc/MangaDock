// CI Jest config — SINGLE SOURCE OF TRUTH. Inherits the inline `jest` block in
// package.json verbatim and only ADDS a skip-list for suites with KNOWN,
// pre-existing failures, so the CI gate stays GREEN and meaningful (a
// perpetually-red gate gets ignored, which is worse than none).
//
// Inheriting from package.json (instead of copying its fields) means a future
// change to the jest config — transform, moduleNameMapper, rootDir — is picked
// up here automatically, so CI never silently drifts from local `npm test`.
//
// The skip-list is now EMPTY (#358 closed): every previously-skipped suite was
// fixed by the batch/cache refactors it was waiting on (#233/#234/#294/#137/#231
// carved the batch orchestrator, mit-translator, PatchStore and gemini-catalog
// out of books.service; #143/ADR-002 dropped the batch Redis pub/sub) and now
// passes. The CI gate runs the FULL suite with zero exclusions.
//
// Rule: do NOT add a new skip without a tracking issue. If a suite ever needs to
// be quarantined again, add its line here WITH the issue number, and delete it
// the moment the suite is fixed — the gate must converge back toward zero.
const base = require('./package.json').jest;

module.exports = {
  ...base,
  testPathIgnorePatterns: [
    ...(base.testPathIgnorePatterns ?? ['/node_modules/']),
    // (empty — no quarantined suites; see #358)
  ],
};
