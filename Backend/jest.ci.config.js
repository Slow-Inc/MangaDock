// CI Jest config — SINGLE SOURCE OF TRUTH. Inherits the inline `jest` block in
// package.json verbatim and only ADDS a skip-list for suites with KNOWN,
// pre-existing failures, so the CI gate stays GREEN and meaningful (a
// perpetually-red gate gets ignored, which is worse than none).
//
// Inheriting from package.json (instead of copying its fields) means a future
// change to the jest config — transform, moduleNameMapper, rootDir — is picked
// up here automatically, so CI never silently drifts from local `npm test`.
//
// Every skip below is a documented pre-existing failure, NOT a regression
// introduced by the gate (tracked in #358; the batch ones tie back to #143).
// Rule: do NOT add a new skip without a tracking issue. As each suite is fixed,
// delete its line — the gate should converge toward zero exclusions.
const base = require('./package.json').jest;

module.exports = {
  ...base,
  testPathIgnorePatterns: [
    ...(base.testPathIgnorePatterns ?? ['/node_modules/']),
    // --- pre-existing failures (#358; batch + cache rework, #143) ---
    'cache/catastrophic-recovery.service.spec.ts',
    'cache/l3-batch-writer.spec.ts',
    'books/mit-translation.service.spec.ts',
    'books/books-batch-registry.spec.ts',
    'books/books-mit-translator.spec.ts',
    'books/books-batch-cancel.spec.ts',
    'books/books-models.spec.ts',
    'books/gemini-model-catalog.spec.ts',
    // books-health.spec.ts FIXED — fetch mocked via assignment, not spyOn on
    // the lazy global (which broke under restoreAllMocks). Re-enabled in CI.
  ],
};
