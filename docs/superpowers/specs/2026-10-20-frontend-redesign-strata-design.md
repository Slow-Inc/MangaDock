# Frontend redesign in the Strata design language — design

**Status:** approved direction, 2026-10-20 (dev, in chat). Input for `/to-prd` → `/to-issues`.
**Branch:** `design/strata-redesign` (worktree `D:\Github\worktrees\strata-redesign`, from `origin/main` `c72838f5`).
**Source of the design language:** the Strata showcase site. Read its system-design set through
`D:\Github\Strata-xeno-System-Design\ROUTER.md` (never load `SYSTEM-DESIGN-FULL.md`). Code: `D:\Github\Strata-xeno Web\`
(tokens `app/globals.css:5-57`, fonts `app/layout.tsx:3-6`, effects `app/effects.css`). The dev's intent for that site is in
the orchestrating Claude session `~/.claude/projects/D--Github-Strata-xeno-Web/77955593-….jsonl` (2026-10-03).

Marks: **(dev)** = the developer decided it. **(agent call)** = decided by the agent while writing this; the dev can overrule.

---

## 1. Intent

MangaDock is a manga **reading app**, not a landing page. The dev wants the whole Frontend to carry the Strata design
language **in full**: high-artcraft detail, *Modern Swiss + Editorial Minimalism + Apple style*, "**Minimal แต่ไม่น่าเบื่อ
เพราะมี Visual ต่างๆ**" (dev). The visuals are **put into each feature area** ("ลูกเล่นตามแต่ละชุด", dev) and serve that
area — they are not hero spectacle for its own sake.

Why now (dev): one recognisable house style across their projects, and the current UI reads as generic AI styling (purple
accents, gradient backgrounds, copy-pasted spinners).

## 2. Goals, non-goals, anti-goals

**Goals**
1. One token system (colour, type, spacing, radius, motion) used by every page; no literal hex in components.
2. Three theme modes — System / Light / Dark — **default Dark** (dev). Strata defaults to System; MangaDock must not.
3. **No purple anywhere**: text, buttons, gradient backgrounds, focus ring, scrollbar (dev). Page background is plain, like
   `/mylist` today (`#0a0a0a`, no gradient) (dev).
4. Every waiting / empty / error moment gets a crafted visual (custom loader, mascot, skeleton) instead of a copied spinner
   or grey text (dev: "หาเองเลย … เช่นการ loading ต่างๆ หรือรอ MIT แปล").
5. Studio is rebuilt as a real dashboard (dev).
6. A mascot cast (bot-avatars) appears across the app, and **users can dress their own mascot and use it as their profile
   picture**; every accessory is free for everyone (dev).

**Non-goals**
- MIT render/translation quality, reader page rendering, backend business logic (other than §8 storage).
- A marketing landing page.
- Strata's product-specific content: the nine-mood story, the Compare window, the live demo proxy, the film section
  (Strata 02 §11.2) — the *patterns* carry over, the content does not.

**Anti-goals** (would be a failure even if it works)
- Purple, gradient blobs, full-page glass, neon, floating orbs, scroll hijacking (Strata's own banned list + dev).
- Effects that slow the reader or the chapter list on a phone. Reading comes first.
- Light mode shipped half-done (dark-coded pages that become white-on-white).
- Text that only exists inside an animation (must read with JS off / reduced motion — Strata P2).

## 3. The design language (what to port)

From Strata 02 §2–§4 and §11.1, verified in its source.

| Area | Value |
|---|---|
| Base colours | light `--bg #f5f5f7` `--surface #fff` `--ink #131316` · dark `--bg #0b0b0d` `--surface #151518` `--ink #f1f1f3` |
| Accent | **blue only**: `#0a62d6` light / `#5aa2ff` dark, used sparingly (status, focus, highlight). Replaces MangaDock's amber `#f59e0b` (dev: "ทั้งหมด"). `--ok #1a8a4a` / `#4cc380` |
| Derived | `--ink-2` = ink 66 % into bg, `--ink-3` 42 %, `--line` ink 12 % alpha, `--fill` ink 6 % alpha (`color-mix`) |
| Type | Inter + Anuphan (Thai) + JetBrains Mono (labels, numbers) + Instrument Serif (one statement word per page at most). Headings weight 600, negative tracking for Latin; **Thai tracking 0, line-height 1.75 body / 1.2 headings** |
| Headline | Gradient Heading (cult-ui), **default neutral variant only** (grey-to-grey, no hue) (dev) — for each page's main title, not every heading (agent call) |
| Layout | 12-col grid, `--gutter clamp(16px,3vw,32px)`, hairline section dividers, wide whitespace, flush left |
| Radius | 8 / 12 / 16, cards 28, pills 999 |
| Motion | one easing `cubic-bezier(.23,1,.32,1)`, 160 / 320 / 600 ms, stagger 38 ms, glide 420 ms `cubic-bezier(.4,0,.2,1)`; everything off under reduced motion |
| Components | pill button 44 px (`--primary` filled ink, `--ghost`), chip that fills ink when selected, mono badge, input pill 48 px, `<details>` disclosure list, sticky 60 px nav with blur |
| Signature | dot motif (logo, hero field, empty states), mood-tinted glows, 3-D point cloud, serif statement word, pointer-tilt — **all of it** (dev), but each used where it means something in that area |

Port rules (Strata 09 "Port playbook", 02 §11.3, 10 §10.2):
- Tokens and motion come from the source CSS, never from screenshots; each number keeps a comment naming its source.
- Clean up while porting: one `.pill` instead of five variants, breakpoints 520 / 700 / 900 / 1020, add spacing and type scales.
- Progressive enhancement: `html.js` gate, final state first, motion as a layer.
- Known traps: spaces inside animated inline-blocks vanish; check `scrollWidth` at 390 px every time; heavy assets load
  near, run only when seen, release on unmount, always have a fallback; cap canvas DPR.

## 4. How it gets made (decided)

- **Fonts via `next/font/google`** (agent call): Inter, Anuphan, JetBrains Mono and Instrument Serif are all on Google
  Fonts. This is the repo's existing idiom (`layout.tsx` uses `Noto_Sans_Thai`) and gives preload with no layout shift.
  Strata used `@fontsource` only because it is plain CSS. Check Anuphan renders the existing Thai UI at body size before
  removing Noto Sans Thai.
- **Tokens:** CSS custom properties in `globals.css`, mapped into Tailwind v4 `@theme inline` so classes like `bg-surface`
  and `text-ink-2` exist. Theme via `data-theme` on `<html>` plus a pre-paint script (Strata 02 §11.1 item 2), initial
  state **dark**.
- **Always-dark islands** (the reader, the book popup backdrop): derived `color-mix` tokens must be re-declared on the island
  or they inherit light values (Strata 02 §11.1 item 1 caveat).
- **Light mode stays hidden until Epic B is done** (agent call): the toggle ships but is not shown in the nav, because about
  44 files hard-code dark colours today.
- **Loaders:** `loading-dev` 0.3.5 (MIT, ~40 loaders, zero runtime deps, React ≥ 19, has reduced-motion handling) replaces
  the copied spinners (dev supplied Atom, Slide). One wrapper component chooses the loader per context (agent call).
- **Mascot:** `bot-avatars` 0.2.2 (MIT, canvas 2-D, zero deps, reduced-motion, pauses off-screen, `role="img"`). Strata
  already uses it (`components/Avatar.tsx`).
- **Studio charts:** ECharts via the evilcharts components the dev linked (https://evilcharts.com/docs/echarts/components),
  plus spell-ui `Chart` (line + tooltip) and `CopyButton`. Shell from the "Dashboard Shell" block and overview from the
  "Analytics Dashboard" block the dev pasted. See §7 for what is still open.

## 5. Epics (four projects, in this order)

### Epic A — Foundation + purple purge (no backend)
1. Tokens (light/dark/system, default dark) + `@theme` mapping + derived tokens + always-dark island rule.
2. Fonts (§4) and type scale; Thai overrides.
3. Theme boot script + 3-state toggle component (hidden in nav until Epic B).
4. Motion tokens, `Reveal` + `html.js` gate, reduced-motion blocks.
5. Primitives: `Button`, `Pill/Chip`, `Badge`, `Input`, `Card`, `Disclosure`, `Loader` (wraps loading-dev), `GradientHeading`.
6. **Purple purge**: 198 occurrences of `indigo-|purple-|violet-|fuchsia-|#6366f1|#8b5cf6` in 49 files on `main`
   (largest: `studio/works`, `community/profile/[uid]`, `community/page`, `ForumSideMenu`, `studio/page`), plus the global
   focus ring `#6366f1` and scrollbar `rgba(99,102,241,.6)` in `globals.css`. PR #703 already removes ~110 of them in
   community/studio — land it first and purge the rest.
7. Shared loading surfaces: `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx` do not exist today; the server-fetched
   home page shows nothing while loading.

### Epic B — Area redesigns (each area gets its own flourish)
Order (agent call): Home/catalog/search → book popup + reader → community → settings/account → admin.
Per-area ideas from the recon (agent call, to be refined per PRD):
- **Search:** skeleton cards with a dot-field shimmer instead of flat grey blocks; `ghost` mascot for "ไม่พบ".
- **Book popup / direct `/book/<id>`:** today the direct link shows a blank home until the fetch ends (`BookRouteModal`
  returns null) — give it a skeleton of the popup. Description translation shows a tiny grey "กำลังแปล..." — use a loader +
  the model badge.
- **Reader translation (MIT):** the stream already gives 5 stages per page (`lib/translationStages.ts`: ตรวจหาข้อความ,
  อ่านข้อความ, แปลด้วย AI, ลบข้อความเดิม, วาดข้อความแปล), elapsed seconds, ETA and cold-start. Show them as a staged
  progress with the `droid` mascot in `working`; patches currently pop in with no fade (`PageRenderer.tsx`); MIT offline =
  `droid` `sleeping`. The captcha gate shows a bare white Turnstile box on black — restyle.
- **Community:** plain background like `/mylist`; no purple; `cat` mascot on empty feeds.
- **Home:** the "Top 10 …" eyebrow uses wide letter-spacing on Thai text, which breaks Thai glyphs — Thai tracking 0.

### Epic C — Studio rebuild
Dashboard Shell layout (resizable sidebar, header with status, tabs with sliding pill, toolbar) replacing `StudioNav` tabs
(agent call); overview in the Analytics Dashboard style (metric cards with rolling digits, sparklines); ECharts + spell-ui
Chart for all charts; CopyButton where something is copied; `mech` mascot. Studio uses `--fill`/tokens, no hue-coded tiles.

### Epic D — Mascot system
- **Cast (agent call):** one character per area so people learn "this one lives here":

  | Area | `type` | accessories | when |
  |---|---|---|---|
  | Reader + MIT translation | `droid` | `headphones`, glasses `round` | `working` while translating (5 stages); `sleeping` when MIT is offline |
  | Search / not found | `ghost` | glasses `shades` | empty search |
  | Community | `cat` | hat `party` | empty feed, first post |
  | Studio | `mech` | hat `beret`, glasses `square` | dashboard, upload, no works yet |
  | Wallet / top-up | `star` | hat `crown` | waiting for payment, success |
  | Login / onboarding | `clover` | `bowTie` | welcome, reader captcha gate |
  | Errors | `pebble` | — | `sleeping` |

  Each instance gets its own `seed`; `theme="auto"`.
- **User mascot (dev):** users dress their own mascot — `type` (18), `face`, body `color`, `hat`, `glasses`, `headphones`,
  `bowTie`, `accessoryColor` — with a live preview, and choose it **or** their OAuth photo as the profile picture. **All
  accessories are free** (dev).
- **Where the profile picture shows** (render sites on `main`): `NavbarActions`, `PostCard`, `CommentThread`,
  `ReaderCommentDrawer`, `ReviewCard`, `MangaDiscussion`, `community/page`, `community/p/[id]`, `community/manga/[mangaId]`,
  `community/profile/[uid]`, `studio/account`, `LinkAccountModal`; data from `AuthContext` and Backend `users.service` /
  `users.controller` / `supabase.service`.
- **Performance (agent call):** long lists (community feed, comments) render the mascot `paused` (a still pose); it animates
  only on the profile page, the user's own nav avatar, and on hover.
- **Default (agent call):** a user who never dressed one gets a stable mascot derived from their uid, not an empty circle.

## 6. Constraints

- Next.js 16.1.6, React 19.2.3, Tailwind v4, `framer-motion` 12 and Lenis already installed; Bun.
- Every UI change is verified end-to-end in the real app (Playwright, 390 / 1024 / 1440 px, reduced motion) with
  screenshots sent to the dev before claiming done (repo rule). Strata's pre-release checklist (09) applies.
- Issues before PRs; bilingual issue/PR bodies; TDD for logic (theme state, mascot config validation, loader selection).
- **Supabase schema change for Epic D** goes to the shared project through MCP `apply_migration` — needs the dev's explicit
  confirmation each time. The Backend DTO validates every mascot field with an allowlist (`@IsIn` per enum), because the
  JSON renders on other users' screens.
- `package.json` / `bun.lock`: PR #758 also changes them. Land #758 before Epic A adds dependencies, or regenerate the lock
  on rebase.
- Open PRs to land first (they touch the same files): #703 (community/studio de-slop), #755 (AuthContext), #758 (book popup).

## 7. Left to the builder / open

- **Third-party intake (Strata P10) not yet done:** licences of the Dashboard Shell / Analytics Dashboard blocks
  (`@/components/block/*`, ObsidianUI per the CSS variable names), spell-ui (`Chart`, `CopyButton`), cult-ui
  (`GradientHeading`), evilcharts. Check each and add credits before copying. React Bits canvas components are MIT +
  Commons Clause — fine for this non-commercial project, but credit them.
- Those blocks import `motion/react`; the repo has `framer-motion` 12 — pick one to avoid shipping both.
- Dashboard Shell switches palette on a `.dark` class; MangaDock uses `data-theme` — bridge or override its `--obsidian-*`
  variables.
- `Frontend/components.json` (shadcn) is untracked in the main checkout and not on `main`; adopting registries means
  committing it.
- ECharts bundle: import from `echarts/core` with only the charts used, loaded on Studio routes only.
- What the 3-D point cloud means in a manga app (Strata's means memory tiers). Needs a concept before it is built.

## 8. Found during recon, not fixed here (each needs its own issue)

- 48 `animate-spin` copies (≈31 ring spinners in 20 files, ≈15 SVG spinners) — replaced by Epic A's `Loader`.
- Reader page strip: the "translating" pulse reads only `translatingCurrentPageIndex`, so during a batch the active page does
  not pulse (subagent finding, **unverified**).
- `/book/<id>` has no `generateMetadata` (shared links preview as the home page); `bookFromDetail.ts:8` unguarded
  `covers[0]`/`genres`; `landing.service.ts:245-258` thought-stripper drops markdown lines (from the #758 review).
- Search input focus ring is still purple (seen at `/search`).
