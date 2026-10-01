#!/usr/bin/env node
/**
 * CLI wrapper for the frontend unit-test selector (see lib/frontend-unit-tests.mjs).
 *
 * Prints one selected test file per line, for `bun test $(…)`. Exits 1 when the selection is
 * empty so the gate can never silently run nothing (or fall back to running ALL tests).
 *
 * Usage (from Frontend/):
 *   bun test $(node ../scripts/list-frontend-unit-tests.mjs app lib)
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { selectUnitTestFiles } from './lib/frontend-unit-tests.mjs';

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('usage: list-frontend-unit-tests.mjs <dir> [dir...]');
  process.exit(2);
}

const all = roots.flatMap((root) =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath ?? e.path, e.name).replaceAll('\\', '/')),
);

const unit = selectUnitTestFiles(all);
if (unit.length === 0) {
  console.error(`✗ no unit test files found under ${roots.join(', ')}`);
  process.exit(1);
}
console.log(unit.join('\n'));
