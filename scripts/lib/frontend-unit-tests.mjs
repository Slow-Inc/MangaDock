/**
 * Frontend unit-test file selection (#643).
 *
 * The bun unit gate must run every `*.test.ts` EXCEPT the suites that need something the
 * gate doesn't provide (a live :4000 server, a Playwright browser). That was an inline
 * `find` in ci.yml with a growing `-not -name` blacklist, and it silently swallowed
 * `mermaid.e2e.test.ts` — a Playwright spec — into the unit run. Pulling the rule into a
 * pure function makes it testable, so the naming convention is enforced by tests instead
 * of by whoever last edited the workflow.
 */

/** Filename qualifiers that mark a `*.test.ts` as NOT part of the unit gate. */
const NON_UNIT_QUALIFIERS = ['e2e', 'integration'];

export function selectUnitTestFiles(files) {
  return files.filter(
    (f) => f.endsWith('.test.ts') && !NON_UNIT_QUALIFIERS.some((q) => f.endsWith(`.${q}.test.ts`)),
  );
}
