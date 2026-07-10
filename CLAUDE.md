<!-- lang:en -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Engineering North Star (applies to every agent, every change)

> **Simplest logic that works · easy to maintain · sustainable long-term · good performance.**

Apply it concretely:

- **Remove complexity rather than prop it up.** If a piece of code is fragile/over-built, prefer deleting it for a simpler equivalent over adding a dependency or layer to keep it alive. (e.g. the GPT few-shot lookup was simplified to a direct dict lookup, dropping the `langcodes`/`language_data` dependency entirely instead of installing it.)
- **Pick the simplest construct that suffices.** Don't reach for heavier machinery than the problem needs (a `set` over an `asyncio.Event` when you only poll a flag; a function over a class for single-use logic).
- **Extract for testability when it pays off.** Move logic into a small, dependency-light module so it can be unit-tested in isolation (e.g. `server/webhook.py` imports only httpx/json/hmac and tests in <1s, not the 22s ML stack).
- **Surgical changes.** Touch only what the task requires; match surrounding style; remove only the orphans your own change creates.
- **Performance counts too** — but don't trade clarity for micro-optimizations that don't matter. Optimize the hot path, keep the rest simple.

When two designs are equally correct, choose the one a future maintainer (human or agent) will understand fastest and that has the fewest moving parts.

---

## Project Memory (Team Shared)

Team memory lives as an **Obsidian vault** at `Obsidian-MangaDock/` in this repo — committed so all team members and agents start with full context. (It used to be flat files under `.claude/memory/`; that folder now holds only a pointer README.)

**At the start of every session, read `Obsidian-MangaDock/Home.md` (the Map-of-Content index) first — then read only the linked notes relevant to the current task, not the whole graph.** (Home.md is small; the ~30 notes it links are not — loading all of them every session defeats the point. Skim Home's one-line descriptions, open the few that matter.)

`Home.md` is the index — memories grouped by `type` (`feedback`, `project`, `reference`). Each note is one memory record with `type` / `description` frontmatter and `[[wikilinks]]` to related notes; open Graph View to see the relationships (unresolved links = memories worth writing).

If you write a new team memory, create a note in `Obsidian-MangaDock/` (filename = its hyphen-kebab slug, matching the `name:` frontmatter so `[[wikilinks]]` resolve) and add a line to `Home.md`. Keep your own local `~/.claude/projects/.../memory/` in sync for personal continuity.

---

## Dev Notifications (agent → developer)

Ping the developer when a long task finishes or needs a decision, so they aren't tied to the terminal:

```bash
pwsh -NoProfile -File scripts/notify.ps1 -Message "build done: 137 tests green"
```

`scripts/notify.ps1` emits a real Windows toast (WinRT via Windows PowerShell 5.1 → Action Center → forwarded to phone by Phone Link). The built-in `PushNotification` tool reports "sent" but does **not** surface a toast on this Win11 + VS Code setup, so prefer the script. Notify on: task/`/tdd` cycle complete, needing a confirm (before closing issues / merging), or AFK batch done — not on routine sub-progress.

---

## Agent skills

### Issue tracker

GitHub Issues on `Slow-Inc/MangaDock` via the `gh` CLI. Issue **and PRD bodies must be bilingual (English + a full Thai mirror — same depth, not a summary)**; review-reply comments may be English-only. External PRs are **not** a triage surface. See `docs/agents/issue-tracker.md`.

**GitHub Issues govern the work — they are the task source of truth, not a formality.** Every code change maps to one issue on `Slow-Inc/MangaDock`: the issue is the record of *what to do* (pick only issues authored by us or labeled `ready-for-agent`) and *its state* (open = outstanding, closed-with-reason = done). Local todos / task-lists are session-scoped working memory only — they must reconcile back to issues (new work surfaced → open an issue; work finished → close it) before the session ends; a task that exists only in a todo with no backing issue is untracked. **Why this is load-bearing (multi-dev team):** work on an issue can be *handed off* to another person instantly (a session-local todo dies with the session), and it *prevents code collisions* — every dev and agent can see who holds which task and stays off files/features someone else is mid-change on. An incomplete or unclosed issue makes the team blind to real state → botched handoffs and clashing edits.

**Issue lifecycle is a Definition-of-Done gate, not optional (both bookends are forgotten because the ordering rule lives only in the on-demand `/to-prd` skill):** any code change must have issue tracking **before a PR** — ordering is **PRD → issues → PR**, never a PR without a referenced issue (PRD per epic, issue per deliverable). **Keep the issue body current as work progresses** — when scope, status, decisions, or what's-done/what's-left change, edit the *body* (not just add a comment) so the next person or agent can take over seamlessly by reading one up-to-date description instead of replaying every comment; the updated body stays **bilingual (EN + full Thai mirror)** like the original. Comments record events/evidence; the body is the current-state single source of truth. And **close the issue when the work is merged/done** (`gh issue close <n> --comment "<impact report>"`) — work finished but the issue left open is **not done**. **Every close must state a REASON in the comment** — never close silently: *completed* (with evidence: commit/test/impact-report), *cancelled/superseded* (by what & why), *duplicate* (of #NNN), *wontfix* (why), or *stale/obsolete* — so a later reader knows why it closed without guessing.

### Triage labels

The five canonical triage states (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) map 1:1 to same-named repo labels, alongside component/type/severity/lifecycle labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` (20 ADRs) at the repo root. See `docs/agents/domain.md`.

### Qwen delegation (claude-9arm)

Offload mechanical, self-contained tasks (bulk renames, boilerplate scaffolding, log/stack-trace summarizing, grep-and-report sweeps) to `claude-9arm` via the `qwen-agent` skill. Never delegate anything touching `auth`/`wallet`/`unlock`, MIT core-pipeline seam work, bilingual issue/PR body authoring, or render-quality/benchmark verdicts — those need judgment a small model doesn't have. See `docs/agents/qwen-delegation.md`.

---

## Repository Structure

```
MangaDock/
├── Frontend/     # Next.js 16 + React 19 (port 4000)
├── Backend/      # NestJS 11 (port 3001 / 4001)
└── MIT/          # Python ML inference server (image translation)
```

---

## Commands

### Frontend (`Frontend/`)
```bash
bun dev          # Start dev server on port 4000 (0.0.0.0)
bun build        # Production build
bun lint         # ESLint
bun test         # Unit tests (bun:test — *.test.ts, excluded from tsconfig)
```

### Backend (`Backend/`)
```bash
npm run start:dev     # Watch mode dev server
npm run build         # Compile
npm run lint          # ESLint + Prettier fix
npm test              # Jest unit tests
npm run test:cov      # Coverage report
npm run test:e2e      # End-to-end tests

# Run a single test file
npx jest src/forum/forum.service.spec.ts --no-coverage

# Debug: wipe translated-patch caches so MIT re-translates from scratch
npm run cache:reset              # delete for real (Redis + L3 disk + uploads/patches)
npm run cache:reset -- --dry-run # list what would be deleted, touch nothing
```

`cache:reset` clears only the `translate:manga-patches:*` namespace (forum/search/mangadex/glossary survive). Selection logic is unit-tested in `src/cache/translation-cache-reset.ts`. Run it before every E2E translation test, then restart the backend to clear the in-memory L1.

---

## Architecture

### Request Flow
All browser API calls are relative (`/api/proxy/...`) and go through a Next.js catch-all route handler at `Frontend/app/api/proxy/[...path]/route.ts`, which server-side proxies to the NestJS backend. This keeps auth tokens off the network edge and works from any host/IP.

Static assets (`/uploads/*`, `/img-cache/*`) are rewritten to the backend via `next.config.ts`.

### Auth
- **Provider**: Supabase Auth (Google OAuth, Facebook OAuth, email/password)
- **Frontend**: `AuthContext.tsx` exposes `AppUser` (mapped from Supabase user) and `showLoginPrompt()`. Always use `showLoginPrompt()` for unauthenticated UI flows — never `alert()`.
- **Backend**: `AuthGuard` validates Bearer JWT from Supabase. `TurnstileGuard` gates auth endpoints. `HardwareIdMiddleware` requires `X-Hardware-Id` header on chapter/upload routes (zero-trust asset protection).

### Frontend Caching (`Frontend/app/lib/apiCache.ts`)
In-memory LRU (500 entries) with stale-while-revalidate pattern. Forum data uses `TTL.SHORT` (60s), search `TTL.MEDIUM` (5 min), quasi-static `TTL.LONG` (30 min). Invalidate by key or tag. `clearAllApiCache()` is called on auth state change to prevent cross-user bleed.

### Real-Time (SSE)
`ForumEventsService` (backend) publishes events to RxJS Subjects + Redis pub/sub channels (`forum:events`, `forum:feed`). Frontend consumes via `useForumStream` / `useFeedStream` hooks which connect to `/api/proxy/forum/posts/:id/stream`. SSE uses exponential backoff retry.

### Smooth Scroll
`SmoothScrolling.tsx` wraps the entire app with a global Lenis `root` instance. It calls `lenis.scrollTo(0, { immediate: true })` on every `pathname` change to prevent scroll position carry-over in Next.js shared layouts. The community sidebar has its own local `ReactLenis` instance (not `root`).

### Community Forum Layout
`app/community/layout.tsx` is a persistent shared layout (survives page navigation). Navigation state (category filter, active manga) lives in URL query params, not component state — the sidebar reads `useSearchParams()` and `usePathname()` to stay in sync across pages. Mobile uses a drawer triggered by a custom `toggleMobileMenu` window event.

### Backend Modules (`Backend/src/`)
| Module | Responsibility |
|--------|---------------|
| `books` | Manga catalog, chapter pages, Google Books integration |
| `forum` | Posts, comments, votes, SSE streaming, trending, profiles |
| `upload` | Image uploads — MIME validated with `file-type` (magic bytes, not extension) |
| `wallet` | Coin balance and transactions |
| `unlock` | Chapter unlock (requires HWID + wallet debit, atomic) |
| `users` | Profile management |
| `versions` | App version delivery |
| `cache` | Redis service wrapper (`RedisService`) |
| `supabase` | Global `SupabaseService` singleton |
| `common/storage` | `StorageProvider` interface (local disk or S3-compatible) |

### Key Patterns & Gotchas

**Spoiler blur**: Use inline `style={{ filter: 'blur(4px)', transition: 'filter 0.5s ease' }}` — never Tailwind `blur-sm`/`blur-0`. Tailwind blur uses `--tw-blur` CSS custom properties which browsers don't transition reliably.

**Image XSS**: Before using a user-supplied URL in `<img src>` or `<a href>`, check:
```ts
const safe = /^\s*(javascript|data|vbscript|file):/i.test(url.trim()) ? '#' : url.trim();
```

**`<img>` vs `<Image>`**: Use Next.js `<Image>` for all images with known dimensions and domain allow-listed in `next.config.ts`. Use `<img>` only for dynamically-sized images where layout is handled by the container.

**Modal animation**: Use double `requestAnimationFrame` for enter (ensures DOM is painted before adding visible class), `setTimeout` for exit (waits for CSS transition before unmounting).

**DTOs with floats**: Use `@IsNumber({ maxDecimalPlaces: 2 })` + `@Type(() => Number)` instead of `@IsInt()` when drag/calculation inputs can produce floating-point values.

**Forum post images**: Stored as `image_urls TEXT[]` in Supabase `forum_posts` table. Apply schema changes via Supabase MCP `apply_migration` — the `supabase-migration.sql` file is reference-only.
<!-- lang:end -->

<!-- lang:th -->
# CLAUDE.md — แนวทางสำหรับ Claude Code

ไฟล์นี้ให้คำแนะนำแก่ Claude Code (claude.ai/code) เมื่อทำงานกับโค้ดใน repository นี้

---

## Engineering North Star (ใช้กับทุก agent ทุกการเปลี่ยนแปลง)

> **Logic ที่เรียบง่ายที่สุดที่ทำงานได้ · ดูแลรักษาง่าย · ยั่งยืนระยะยาว · performance ดี**

ใช้งานอย่างเป็นรูปธรรม:

- **ลบความซับซ้อนแทนที่จะค้ำมันไว้** ถ้าโค้ดส่วนไหนเปราะหรือ over-built ควรลบแล้วแทนด้วยของที่เรียบง่ายกว่า ดีกว่าเพิ่ม dependency หรือ layer เพื่อให้ยังรันได้ (เช่น GPT few-shot lookup ถูก simplify เป็น dict lookup ตรงๆ ลบ dependency `langcodes`/`language_data` ทิ้งเลยแทนที่จะลง)
- **เลือก construct ที่เรียบง่ายที่สุดที่เพียงพอ** อย่าใช้เครื่องมือหนักกว่าปัญหาต้องการ (`set` แทน `asyncio.Event` เมื่อแค่ poll flag; function แทน class สำหรับ logic ที่ใช้ครั้งเดียว)
- **แยกออกมาเพื่อ testability เมื่อคุ้มค่า** ย้าย logic เข้า module เล็กที่มี dependency น้อยเพื่อ unit test แยกได้ (เช่น `server/webhook.py` import เฉพาะ httpx/json/hmac และ test ใน <1s ไม่ต้องลาก ML stack 22s)
- **เปลี่ยนแบบ Surgical** แตะเฉพาะที่ task ต้องการ; ตามสไตล์โค้ดรอบข้าง; ลบเฉพาะ orphan ที่ change ของตัวเองสร้างขึ้น
- **Performance สำคัญด้วย** — แต่อย่าแลกความชัดเจนเพื่อ micro-optimization ที่ไม่มีผล optimize hot path, ส่วนที่เหลือให้เรียบง่าย

เมื่อ design สองอย่างถูกต้องเท่ากัน ให้เลือกอันที่ผู้ดูแลในอนาคต (มนุษย์หรือ agent) จะเข้าใจได้เร็วที่สุดและมี moving parts น้อยที่สุด

---

## Project Memory (ทีมใช้ร่วมกัน)

memory ของทีมอยู่เป็น **Obsidian vault** ที่ `Obsidian-MangaDock/` ใน repo นี้ — commit ไว้เพื่อให้สมาชิกทีมและ agent ทุกคนเริ่มด้วย context ครบ (เดิมเป็นไฟล์ flat ใน `.claude/memory/`; ตอนนี้โฟลเดอร์นั้นเหลือแค่ README ชี้ทาง)

**ทุกครั้งที่เริ่ม session ต้องอ่าน `Obsidian-MangaDock/Home.md` (Map-of-Content index) ก่อน — แล้วอ่านเฉพาะ note ที่ link ซึ่งเกี่ยวกับงานที่กำลังทำ ไม่ใช่ทั้งกราฟ** (Home.md เล็ก แต่ ~30 note ที่มัน link ไม่เล็ก — โหลดทั้งหมดทุก session เสียเปล่า; อ่าน one-line description ใน Home แล้วเปิดเฉพาะอันที่เกี่ยว)

`Home.md` คือ index — จัดกลุ่ม memory ตาม `type` (`feedback`, `project`, `reference`) แต่ละ note = memory เดียว มี frontmatter `type` / `description` + `[[wikilinks]]` เชื่อมเรื่องที่เกี่ยวข้อง; เปิด Graph View เพื่อเห็นความสัมพันธ์ (link ที่ยังไม่มีไฟล์ = memory ที่ควรเขียนเพิ่ม)

ถ้าเขียน memory ใหม่ของทีม ให้สร้าง note ใน `Obsidian-MangaDock/` (ชื่อไฟล์ = slug แบบ hyphen-kebab ให้ตรงกับ `name:` ใน frontmatter เพื่อให้ `[[wikilinks]]` resolve) แล้วเพิ่มบรรทัดใน `Home.md`; และ sync `~/.claude/projects/.../memory/` ของตัวเองไว้เพื่อความต่อเนื่องส่วนตัว

---

## Dev Notifications (agent → developer)

แจ้งเตือน developer เมื่อ task ยาวเสร็จหรือต้องตัดสินใจ จะได้ไม่ต้องเฝ้า terminal:

```bash
pwsh -NoProfile -File scripts/notify.ps1 -Message "build done: 137 tests green"
```

`scripts/notify.ps1` ยิง Windows toast จริง (WinRT ผ่าน Windows PowerShell 5.1 → Action Center → Phone Link ส่งต่อเข้ามือถือ) tool `PushNotification` ในตัวขึ้น "sent" แต่ **ไม่เด้ง** บนเครื่อง Win11 + VS Code นี้ จึงใช้ script แทน ยิงเมื่อ: จบ task/รอบ `/tdd`, ต้อง confirm (ก่อนปิด issue / merge), หรือ AFK เสร็จ — ไม่ใช่ progress ย่อยๆ

---

## โครงสร้าง Repository

```
MangaDock/
├── Frontend/     # Next.js 16 + React 19 (port 4000)
├── Backend/      # NestJS 11 (port 3001 / 4001)
└── MIT/          # Python ML inference server (image translation)
```

---

## คำสั่ง

### Frontend (`Frontend/`)
```bash
bun dev          # Start dev server บน port 4000 (0.0.0.0)
bun build        # Production build
bun lint         # ESLint
bun test         # Unit tests (bun:test — *.test.ts ถูก exclude จาก tsconfig)
```

### Backend (`Backend/`)
```bash
npm run start:dev     # Watch mode dev server
npm run build         # Compile
npm run lint          # ESLint + Prettier fix
npm test              # Jest unit tests
npm run test:cov      # Coverage report
npm run test:e2e      # End-to-end tests

# รัน test file เดียว
npx jest src/forum/forum.service.spec.ts --no-coverage

# Debug: ล้าง translated-patch cache เพื่อให้ MIT แปลใหม่จากศูนย์
npm run cache:reset              # ลบจริง (Redis + L3 disk + uploads/patches)
npm run cache:reset -- --dry-run # ดูว่าจะลบอะไร ไม่แตะของจริง
```

`cache:reset` ลบเฉพาะ namespace `translate:manga-patches:*` (forum/search/mangadex/glossary รอด) logic การเลือกถูก unit-test ใน `src/cache/translation-cache-reset.ts` รันก่อน test การแปล E2E ทุกครั้ง แล้ว restart backend เพื่อล้าง L1 in-memory

---

## สถาปัตยกรรม

### Request Flow
API call จาก browser ทั้งหมดเป็น relative (`/api/proxy/...`) และผ่าน Next.js catch-all route handler ที่ `Frontend/app/api/proxy/[...path]/route.ts` ซึ่ง proxy ฝั่ง server ไปยัง NestJS backend ทำให้ auth token ไม่โผล่ที่ network edge และใช้งานได้จากทุก host/IP

Static assets (`/uploads/*`, `/img-cache/*`) ถูก rewrite ไปยัง backend ผ่าน `next.config.ts`

### Auth
- **Provider**: Supabase Auth (Google OAuth, Facebook OAuth, email/password)
- **Frontend**: `AuthContext.tsx` expose `AppUser` (map จาก Supabase user) และ `showLoginPrompt()` ต้องใช้ `showLoginPrompt()` เสมอสำหรับ unauthenticated UI flow — ห้ามใช้ `alert()`
- **Backend**: `AuthGuard` validate Bearer JWT จาก Supabase `TurnstileGuard` gate auth endpoint `HardwareIdMiddleware` ต้องการ header `X-Hardware-Id` บน chapter/upload route (zero-trust asset protection)

### Frontend Caching (`Frontend/app/lib/apiCache.ts`)
In-memory LRU (500 entries) พร้อม stale-while-revalidate pattern ข้อมูล Forum ใช้ `TTL.SHORT` (60s), search `TTL.MEDIUM` (5 min), quasi-static `TTL.LONG` (30 min) Invalidate ด้วย key หรือ tag `clearAllApiCache()` เรียกเมื่อ auth state เปลี่ยนเพื่อป้องกัน cross-user bleed

### Real-Time (SSE)
`ForumEventsService` (backend) publish event ไปยัง RxJS Subjects + Redis pub/sub channels (`forum:events`, `forum:feed`) Frontend consume ผ่าน hook `useForumStream` / `useFeedStream` ที่เชื่อมต่อกับ `/api/proxy/forum/posts/:id/stream` SSE ใช้ exponential backoff retry

### Smooth Scroll
`SmoothScrolling.tsx` ครอบทั้ง app ด้วย Lenis `root` instance global มันเรียก `lenis.scrollTo(0, { immediate: true })` ทุกครั้งที่ `pathname` เปลี่ยนเพื่อป้องกัน scroll position carry-over ใน Next.js shared layouts sidebar community มี `ReactLenis` instance local ของตัวเอง (ไม่ใช่ `root`)

### Community Forum Layout
`app/community/layout.tsx` เป็น persistent shared layout (รอดจาก page navigation) Navigation state (category filter, active manga) อยู่ใน URL query params ไม่ใช่ component state — sidebar อ่าน `useSearchParams()` และ `usePathname()` เพื่อ sync ข้ามหน้า Mobile ใช้ drawer ที่ trigger ด้วย custom window event `toggleMobileMenu`

### Backend Modules (`Backend/src/`)
| Module | หน้าที่ |
|--------|---------|
| `books` | Manga catalog, chapter pages, Google Books integration |
| `forum` | Posts, comments, votes, SSE streaming, trending, profiles |
| `upload` | Image uploads — MIME validated ด้วย `file-type` (magic bytes ไม่ใช่ extension) |
| `wallet` | Coin balance และ transactions |
| `unlock` | Chapter unlock (ต้องการ HWID + wallet debit, atomic) |
| `users` | Profile management |
| `versions` | App version delivery |
| `cache` | Redis service wrapper (`RedisService`) |
| `supabase` | Global `SupabaseService` singleton |
| `common/storage` | `StorageProvider` interface (local disk หรือ S3-compatible) |

### Patterns สำคัญและข้อควรระวัง

**Spoiler blur**: ใช้ inline `style={{ filter: 'blur(4px)', transition: 'filter 0.5s ease' }}` — ห้ามใช้ Tailwind `blur-sm`/`blur-0` Tailwind blur ใช้ CSS custom properties `--tw-blur` ที่ browser ไม่ transition ได้อย่างน่าเชื่อถือ

**Image XSS**: ก่อนใช้ URL ที่ user ระบุใน `<img src>` หรือ `<a href>` ตรวจสอบ:
```ts
const safe = /^\s*(javascript|data|vbscript|file):/i.test(url.trim()) ? '#' : url.trim();
```

**`<img>` vs `<Image>`**: ใช้ Next.js `<Image>` สำหรับรูปที่รู้ขนาดและ domain อยู่ใน allow-list ของ `next.config.ts` ใช้ `<img>` เฉพาะรูปที่ขนาด dynamic ซึ่ง container จัดการ layout

**Modal animation**: ใช้ double `requestAnimationFrame` สำหรับ enter (รอให้ DOM paint ก่อนเพิ่ม visible class), `setTimeout` สำหรับ exit (รอ CSS transition ก่อน unmount)

**DTOs with floats**: ใช้ `@IsNumber({ maxDecimalPlaces: 2 })` + `@Type(() => Number)` แทน `@IsInt()` เมื่อ drag/calculation input อาจได้ค่า floating-point

**Forum post images**: เก็บเป็น `image_urls TEXT[]` ใน Supabase table `forum_posts` ใช้ Supabase MCP `apply_migration` สำหรับ schema change — ไฟล์ `supabase-migration.sql` เป็นแค่ reference
<!-- lang:end -->
