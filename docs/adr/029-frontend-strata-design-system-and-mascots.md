# ADR 029 — Frontend design system: Strata tokens, dark by default, mascots as identity

- **Status:** Accepted (2026-10-20)
- **Issues:** #764 (plan), #765 (Epic A foundation), #772 (Epic B areas), #780 (Epic C Studio),
  #781 (Epic D mascots).
- **Area:** `Frontend/app/globals.css` (tokens), `Frontend/app/layout.tsx` (theme boot),
  `Frontend/app/components/ui/*` (primitives), `Frontend/app/components/mascot/*`,
  `Frontend/app/lib/mascot.ts`, `Backend/src/users` (`GET/PUT /users/me/mascot`), `DESIGN.md`.
- **Spec:** `docs/superpowers/specs/2026-10-20-frontend-redesign-strata-design.md`.

## Context

The app had grown page by page: hard-coded hex colours, a purple accent and purple gradients
(community, buttons, headings), Tailwind `blur-*` and `white/NN` alpha classes written per page, and
three loader styles. Changing one surface meant editing dozens of files, and a light theme was not
possible because nothing referred to a shared colour. The developer chose the Strata website's design
language (Modern Swiss + editorial minimalism, Apple-like restraint) and asked for the purple to go,
for "minimal but not boring" visuals, and for bot-avatars mascots users can dress and use as a
profile picture.

## Decision

1. **One token set.** Colours are CSS custom properties on `:root` (`--bg`, `--surface`, `--fill`,
   `--line`, `--ink`/`--ink-2`/`--ink-3`, `--accent`, `--ok`, `--danger`, `--coin`, `--scrim`),
   radii (`--r1..--r3`, `--r-card`) and motion (`--t1/--t2`, `--ease`), exposed to Tailwind as
   `bg-bg`, `text-ink-2`, `border-line`… Pages use tokens only; the migration table is `DESIGN.md` §8.
2. **Dark by default, three modes.** `layout.tsx` renders `data-theme="dark"`; a boot script applies
   the saved choice before first paint. The light theme exists in tokens, but the toggle stays hidden
   until every user route is token-clean (#778 — blocked on the parked auth-flow files).
3. **No purple.** Accent is Strata blue (`#0a62d6` light / `#5aa2ff` dark). Backgrounds are plain
   surfaces; gradient headings are neutral only.
4. **One loader family** (loading-dev): page/section = Atom, inline = Arc, MIT translation = Slide.
5. **Mascots (bot-avatars) are part of identity, not decoration only.** Each area has a cast member
   (reader droid, search ghost, community cat, studio mech, wallet star, login clover, error pebble).
   Users dress their own; the config is stored in `profiles.mascot` (jsonb) and a still PNG is uploaded
   through the existing avatar upload into `photo_url`, so every avatar surface shows it without change.
   Long lists render mascots paused.
6. **Studio charts use ECharts** through the vendored evilcharts core, imported on demand on Studio
   routes only; chart colours are read from the tokens at render time.

## Alternatives considered

- **Keep per-page classes and restyle in place** — no light theme possible, and the next redesign
  costs the same again.
- **A component library theme (shadcn tokens as-is)** — its neutral palette and radii are not the
  Strata language the developer chose; we kept our own token names and only borrowed primitives.
- **Mascot as a separate avatar field** — every avatar surface (navbar, community, reviews,
  comments) would need a second code path. Writing the PNG to `photo_url` reuses all of them.

## Consequences

- New UI must use tokens; a hex colour or `white/NN` class in a page is a review finding.
- The light theme is one switch away but must not ship before the remaining routes are migrated.
- `profiles.mascot` needs the migration `Backend/migrations/2026-10-20-profiles-mascot.sql` applied
  (needs developer confirmation; not applied at the time of writing). Until then the editor opens on
  a generated default (`GET` returns nothing) and saving reports an error toast.
- `/docs`, `/status`, `/metrics` remain dark islands outside this system.
