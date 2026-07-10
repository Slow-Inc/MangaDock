---
name: reference_frontend_test_gotchas
description: Frontend `bun test` includes 2 integration files that fail without a running dev server / playwright — not regressions; React Compiler is NOT build-enabled
metadata:
  type: reference
---

`Frontend/` runs unit tests with `bun test` (`*.test.ts`). Two files in the suite are **integration/E2E**, not unit, and FAIL in a bare `bun test` run — treat as environment, not regression:

- `app/docs/__tests__/docs.integration.test.ts` — "docs page — SSR output" (8 tests): `fetch("http://localhost:4000/docs")` → `ConnectionRefused` unless `bun dev` is running.
- `app/docs/__tests__/mermaid.integration.test.ts` — errors with `Cannot find module '@playwright/test'` (Playwright not installed as a dep).

A clean unit run = **all pass except those two files**. As of 2026-07-11: 213 unit `pass`, only `docs page — SSR output` failing (server not up).

**React Compiler is NOT enabled** at build time (no `reactCompiler` in `next.config.ts`, no `babel-plugin-react-compiler` installed), so manual `useMemo`/`useCallback`/`React.memo` DO matter. But `eslint-plugin-react-hooks` v6 ships the compiler lint rules anyway: a `useMemo` with incomplete deps triggers `react-hooks/preserve-manual-memoization` as an **error** (not just exhaustive-deps warning). Fix = list every referenced value (including stable refs) in the deps array.

Reader perf note (PRs on `feat/dashboard`): `React.memo(PageRenderer)` only skips renders if `viewport` is referentially stable — `useReaderViewport` returns a fresh object each render, so it had to be `useMemo`'d and `useZoomPan`'s `zoomIn/zoomOut/zoomReset` `useCallback`'d. During active translation the memo still re-renders (status props legitimately change each tick); the banked win is not rebuilding the `pages` array + `encodeURIComponent`×N per tick.
