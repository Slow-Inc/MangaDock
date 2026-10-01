# PRD / Epic — Dashboard redesign: live-native (real MIT data or "No Data") + Speck/PremiumBuss/Arcana design system

<!-- Original title said "Finesse UI design system" — superseded; see the Updates note below + dashboardv2/DESIGN.md. -->
<!-- "Finesse UI" appears throughout the body below as the original (now-superseded) direction; the Updates note corrects it. -->


> Status: Ready-for-agent (2026-06-17). Parent: #279 (Staff Console). Relates to #282 / #283 (Frontend/Backend
> live feeds — the "No Data" dependency). Design direction (ORIGINAL — **superseded**, see Updates note below):
> ~~Finesse UI~~ → **Speck + PremiumBuss + Arcana**. Design + scope locked via a `/grill-me` session.
> EN + ไทย (ไทยแปลเต็ม — mirrors the English exactly, per `docs/agents/issue-tracker.md`).
>
> **⚠️ Updates (2026-06-18) — three things changed after this PRD; canonical spec is now
> [`dashboardv2/DESIGN.md`](../../dashboardv2/DESIGN.md):**
> 1. **Design direction is NOT Finesse UI.** It is **Speck + PremiumBuss + Arcana, fused** (warm monotone + coral
>    signature + lime/heatmap/big-numbers + ring gauges/inverted card/light theme).
> 2. **`live-or-No-Data` is the REALTIME-mode rule, not an absolute.** A `NEXT_PUBLIC_MOCKUP_MODE` **mock mode** was
>    added *for UX drafting*: in mock mode every panel shows mock; in realtime mode the live-or-No-Data rule below
>    applies. Mock is env-gated and shares the live render path (one `useLiveSnapshot`), so it documents the live UX
>    rather than diverging — it does not violate the "no scattered mock consts" intent (the consts live in one tested
>    `lib/mock-live.ts`, not in components).
> 3. **The rebuild moved to a clean project `dashboardv2/` with a single-page shell IA** (not the route-based I1–I6
>    slices below). The I1 data-layer foundation and the live-or-No-Data principle carry forward; the I3–I6 layout
>    slices are superseded by the V2 IA in `dashboardv2/DESIGN.md` §4.

## Problem Statement

The standalone Dev **Dashboard** has two coupled problems. (1) **It renders hardcoded mock data everywhere** — fake
metrics, fake graphs, fake queue jobs, fake activity feed/logs, fake subsystem/traffic/stream/incident panels. Only
MIT has a live feed (`/api/live`); everything non-MIT (Frontend, Backend, Redis, Supabase, payment, R2, traffic,
streams, incidents) is mock with **no real source**, so the console quietly lies. (2) **The visual design needs a full
overhaul** to a cohesive, production-grade system. The mock is also **tech debt**: scattered `const` blobs in
`lib/services.ts`, duplicated chart-axis/generator helpers, and self-contained mock in ~20 components.

Because a full visual rebuild throws the component markup away, **de-mocking the old components first would be wasted
work** — they would be rewritten. The two efforts must merge: rebuild the dashboard **live-native** (consuming real
MIT data or "No Data" from the start) in the new design.

**(ไทย)** **Dashboard** ฝั่ง Dev มี 2 ปัญหาที่พันกัน (1) **วาด mock ที่ฮาร์ดโค้ดไว้ทุกที่** — metric/กราฟ/job คิว/activity feed/log/panel
subsystem/traffic/stream/incident ปลอม มีแค่ MIT ที่มี live feed (`/api/live`) ทุกอย่างที่ไม่ใช่ MIT (Frontend, Backend, Redis,
Supabase, payment, R2, traffic, streams, incidents) เป็น mock ที่ **ไม่มี source จริง** คอนโซลจึงโกหกเงียบๆ (2) **design ต้อง
ยกเครื่องใหม่ทั้งหมด** ไปเป็นระบบที่สอดคล้องระดับ production และ mock ยังเป็น **tech debt**: `const` ข้อมูลปลอมกระจายใน
`lib/services.ts`, helper สร้างแกน/เส้นกราฟซ้ำซ้อน, mock ฝังใน component ~20 ตัว

เพราะ rebuild visual ทั้งหมดทิ้ง markup ของ component อยู่แล้ว **de-mock component เก่าก่อนจึงเสียเปล่า** — มันจะถูกเขียนใหม่ สองงานต้อง
merge: rebuild dashboard ให้ **live-native** (อ่าน MIT จริงหรือ "No Data" ตั้งแต่แรก) ในดีไซน์ใหม่

## Solution

Redesign the Dashboard into a cohesive **Finesse UI**-style system, rebuilding every surface **live-native**: each
panel shows real MIT telemetry where a source exists, or an explicit **"No Data"** state designed in from the start.
Pages with zero live source (Frontend/Backend detail) show one page-level "telemetry not wired (#282/#283)" message.
A durable, design-agnostic **data layer** (`useMitLive` + the pure mappers + the per-panel source classification) is
built once and consumed by the new components; the old components + all mock `const`s + duplicated generators are
deleted. Net: less code, real data, one cohesive design.

**(ไทย)** redesign Dashboard เป็นระบบสไตล์ **Finesse UI** ที่สอดคล้องกัน rebuild ทุก surface ให้ **live-native**: แต่ละ panel แสดง MIT
telemetry จริงถ้ามี source หรือ state **"No Data"** ที่ออกแบบไว้ตั้งแต่แรก หน้าที่ไม่มี live source เลย (Frontend/Backend) แสดง message
ระดับหน้าอันเดียว "telemetry not wired (#282/#283)" สร้าง **data layer** ที่ design-agnostic + durable (`useMitLive` + pure
mapper + การจัด source ราย panel) ครั้งเดียว แล้วให้ component ใหม่ consume ลบ component เก่า + mock `const` ทั้งหมด + generator
ซ้ำซ้อนทิ้ง สุทธิ: โค้ดน้อยลง ข้อมูลจริง ดีไซน์สอดคล้องเดียว

## Why this design (constraints + locked decisions)

- **Only MIT is live today.** Frontend `/status` (#283) / Backend `/status` (#282) are not built → those surfaces are
  "No Data" until they land. This epic does **not** build those feeds.
- **MIT worker telemetry is run-gated.** `stages`/`vram`(per-model)/`queueJobs` populate after a translate; before the
  first run they are "No Data". `telemetry_store` keeps the last values (persist on idle); `queueJobs` clears real-time.
- **Locked design (from `/grill-me`):** whole dashboard → live or "No Data"; empty pages → one page-level message;
  MIT FEED → real `live.events`; pipeline stages → timing-only live from `mit.stages` (no faked per-stage detail);
  mixed panels → per-item; fully-non-MIT panels → one "No Data" box; mock consts → deleted; "No Data" English-only.
- **Merge, not sequence.** Full overhaul → do NOT de-mock the old components; rebuild them live-native in the new
  design (touch each surface once). The data layer is the only thing built ahead of the visual work.
- **Design direction = ~~Finesse UI~~ → Speck + PremiumBuss + Arcana** (superseded — see Updates note; light/dark).

**(ไทย)**
- **ตอนนี้มีแค่ MIT ที่ live** Frontend `/status` (#283) / Backend `/status` (#282) ยังไม่ build → surface พวกนั้นเป็น "No Data"
  จนกว่าจะมา epic นี้ **ไม่** build feed พวกนั้น
- **MIT worker telemetry ขึ้นกับการรัน** `stages`/`vram`(ราย model)/`queueJobs` ขึ้นหลังแปล ก่อนรันครั้งแรกเป็น "No Data"
  `telemetry_store` เก็บค่าล่าสุด (คงตอน idle) `queueJobs` เคลียร์ real-time
- **Design ที่ล็อก (จาก `/grill-me`):** ทั้ง dashboard → live หรือ "No Data" หน้าว่าง → message ระดับหน้าอันเดียว MIT FEED →
  `live.events` จริง pipeline stages → live เฉพาะ timing จาก `mit.stages` (ไม่มี detail ราย stage ปลอม) panel ผสม → ราย item
  panel ที่ไม่ใช่ MIT ทั้งอัน → กล่อง "No Data" อันเดียว mock consts → ลบ "No Data" อังกฤษอย่างเดียว
- **Merge ไม่ใช่ทำเป็นลำดับ** full overhaul → **ไม่** de-mock component เก่า rebuild ให้ live-native ในดีไซน์ใหม่ (แตะแต่ละ surface
  ครั้งเดียว) data layer เป็นสิ่งเดียวที่ build ก่อนงาน visual
- **Design direction = ~~Finesse UI~~ → Speck + PremiumBuss + Arcana** (superseded — ดู Updates note; light/dark)

## User Stories

1. As an operator, I want every number/graph on the Dashboard to be real MIT telemetry, so I never act on fake data.
2. As an operator, I want panels with no source to show a designed "No Data" state, so I know what is unwired vs broken.
3. As an operator, I want Frontend/Backend pages (no feed yet) to show one "telemetry not wired (#282/#283)" message.
4. As an operator, I want a cohesive, professional (Finesse UI) look across the whole console, with light/dark themes.
5. As an operator, I want live graphs with a real wall-clock time axis and a real MIT activity feed from the stream.
6. As an operator, I want mixed panels (system flow, subsystem board, pipeline) live per-item where MIT reports it.
7. As an operator, I want pipeline stages to show real per-stage timing from MIT, with no faked per-stage detail.
8. As an operator, I want VRAM-by-model (+ leak flags), worker pid/uptime, and the `mit@console` to be real.
9. As a maintainer, I want one `useMitLive` hook + one `<NoData>` primitive, so the live-or-No-Data decision lives in one place.
10. As a maintainer, I want all mock `const`s and the duplicated chart/generator helpers and the old components deleted.
11. As a maintainer, I want the pure mappers unit-tested through the rebuild, so data behaviour stays pinned.
12. As a designer, I want the live/No-Data/loading/empty/error states designed up front, not bolted on after.

**(ไทย)**
1. ในฐานะ operator ฉันอยากให้ทุกตัวเลข/กราฟเป็น MIT telemetry จริง จะได้ไม่ตัดสินใจจากข้อมูลปลอม
2. ในฐานะ operator ฉันอยากให้ panel ที่ไม่มี source แสดง state "No Data" ที่ออกแบบไว้ จะได้รู้ว่ายังไม่ต่อสายหรือพัง
3. ในฐานะ operator ฉันอยากให้หน้า Frontend/Backend (ยังไม่มี feed) แสดง message เดียว "telemetry not wired (#282/#283)"
4. ในฐานะ operator ฉันอยากได้ลุคที่สอดคล้องระดับ professional (Finesse UI) ทั้งคอนโซล พร้อม theme light/dark
5. ในฐานะ operator ฉันอยากได้กราฟ live ที่แกนเวลาเป็นนาฬิกาจริง และ MIT activity feed จริงจาก stream
6. ในฐานะ operator ฉันอยากให้ panel ผสม (system flow, subsystem board, pipeline) live ราย item ตรงที่ MIT รายงาน
7. ในฐานะ operator ฉันอยากให้ pipeline stages แสดง timing ราย stage จริงจาก MIT โดยไม่มี detail ราย stage ปลอม
8. ในฐานะ operator ฉันอยากให้ VRAM-by-model (+ leak flag), pid/uptime ของ worker และ `mit@console` เป็นของจริง
9. ในฐานะ maintainer ฉันอยากได้ hook `useMitLive` ตัวเดียว + primitive `<NoData>` ตัวเดียว ให้การตัดสิน live-or-No-Data อยู่ที่เดียว
10. ในฐานะ maintainer ฉันอยากให้ลบ mock `const` ทั้งหมด + helper สร้างกราฟ/generator ซ้ำซ้อน + component เก่าทิ้ง
11. ในฐานะ maintainer ฉันอยากให้ pure mapper มี unit test ตลอด rebuild เพื่อ pin behaviour ของข้อมูล
12. ในฐานะ designer ฉันอยากให้ state live/No-Data/loading/empty/error ถูกออกแบบตั้งแต่แรก ไม่ใช่แปะทีหลัง

## Implementation Decisions (the slice map)

The epic is sliced into 6 issues. Order = dependency order:

- **I1 — Data foundation (AFK · tech-debt).** `hooks/use-mit-live.ts` (folds `useDevAuth` + `useLiveSnapshot` +
  `liveMit` + `series`/`seriesT`); the per-panel **source classification** (MIT-live / mixed / no-source) as the
  authoritative table; extend/keep the pure mappers (`live-map`, `live-series`, `live-panels`, `mit-console`). Design-
  agnostic, durable, and the **input that tells the design what data each panel has**. Blocked by: none.
- **I2 — Design system + redesign (HITL · design).** `/impeccable shape` → a Finesse UI-style design system (tokens,
  typography, corner radius, light/dark) + the new layout + the designed **data-states** (live / No-Data / loading /
  empty / error) for every panel archetype. Output: `Dashboard/DESIGN.md` + component shells/mockups. Needs design
  review. Blocked by: I1 (the source classification).
- **I3 — Rebuild Overview live-native (AFK).** New overview in the design, consuming the data layer: telemetry graphs,
  mixed panels per-item, non-MIT → No Data, MIT FEED live. Blocked by: I1 + I2.
- **I4 — Rebuild `/service/mit` live-native (AFK).** The MIT detail page re-skinned in the new design, keeping the
  already-live graphs/panels/`mit@console`. Blocked by: I1 + I2.
- **I5 — Rebuild Frontend/Backend pages + shell/nav/sidebar (AFK).** Page-level "telemetry not wired" message; new
  shell/navigation/account in the design. Blocked by: I1 + I2.
- **I6 — Delete old components + all mock (AFK · tech-debt removal).** Remove the superseded components + `services.ts`
  mock consts + `series.ts` `gen`/`TIME`, `page.tsx` `wave`/`STATUSES`, `live-activity` `EVENTS`. Blocked by: I3+I4+I5.

**(ไทย)** epic แบ่งเป็น 6 issue เรียงตาม dependency:

- **I1 — Data foundation (AFK · tech-debt)** `hooks/use-mit-live.ts` (รวม `useDevAuth` + `useLiveSnapshot` + `liveMit` +
  `series`/`seriesT`) การจัด **source ราย panel** (MIT-live / mixed / no-source) เป็นตารางหลัก ขยาย/เก็บ pure mapper
  (`live-map`, `live-series`, `live-panels`, `mit-console`) design-agnostic, durable และเป็น **input ที่บอก design ว่าแต่ละ
  panel มีข้อมูลอะไร** blocked by: ไม่มี
- **I2 — Design system + redesign (HITL · design)** `/impeccable shape` → design system สไตล์ Finesse UI (token,
  typography, corner radius, light/dark) + layout ใหม่ + ออกแบบ **data-state** (live / No-Data / loading / empty / error)
  ให้ทุก archetype ของ panel output: `Dashboard/DESIGN.md` + component shell/mockup ต้อง review design blocked by: I1
  (source classification)
- **I3 — Rebuild Overview live-native (AFK)** overview ใหม่ในดีไซน์ consume data layer: telemetry graph, panel ผสมราย item,
  non-MIT → No Data, MIT FEED live blocked by: I1 + I2
- **I4 — Rebuild `/service/mit` live-native (AFK)** หน้า MIT detail re-skin ในดีไซน์ใหม่ คงกราฟ/panel/`mit@console` ที่ live แล้ว
  blocked by: I1 + I2
- **I5 — Rebuild Frontend/Backend pages + shell/nav/sidebar (AFK)** message ระดับหน้า "telemetry not wired" shell/navigation/
  account ใหม่ในดีไซน์ blocked by: I1 + I2
- **I6 — ลบ component เก่า + mock ทั้งหมด (AFK · tech-debt removal)** ลบ component ที่ถูกแทน + `services.ts` mock consts +
  `series.ts` `gen`/`TIME`, `page.tsx` `wave`/`STATUSES`, `live-activity` `EVENTS` blocked by: I3+I4+I5

## Testing Decisions

- A good test verifies **behaviour through the public interface**, not mock data. The pure mappers stay unit-tested:
  `live-map`, `live-series`, `live-panels`, `mit-console`. Add tests for the live-or-No-Data resolver + the
  pipeline-stage mapper. The new components/pages are integration-style (visual): `bun test` (unit) + typecheck + the
  running dashboard. No snapshot tests of mock markup (there is none).
- Prior art: `lib/*.test.ts` (bun:test) — `live-map.test.ts`, `live-series.test.ts`, `live-panels.test.ts`,
  `mit-console.test.ts`, `snapshot.test.ts`.

**(ไทย)**
- test ที่ดี verify **behaviour ผ่าน public interface** ไม่ใช่ข้อมูล mock pure mapper ยังมี unit test: `live-map`, `live-series`,
  `live-panels`, `mit-console` เพิ่ม test ให้ resolver live-or-No-Data + mapper pipeline-stage component/page ใหม่เป็น
  integration (visual): `bun test` (unit) + typecheck + dashboard ที่รันอยู่ ไม่มี snapshot test ของ mock markup (ไม่มี mock)
- Prior art: `lib/*.test.ts` (bun:test) — `live-map.test.ts`, `live-series.test.ts`, `live-panels.test.ts`,
  `mit-console.test.ts`, `snapshot.test.ts`

## Out of Scope

- Building the Frontend `/status` (#283) and Backend `/status` (#282) live feeds — those surfaces stay "No Data".
- Adding new MIT instrumentation (per-stage run-summary detail, GPU clocks, CPU temp) — panels show "No Data".
- The non-Dashboard apps (Frontend/Backend/MIT app code) — untouched.

**(ไทย)**
- build Frontend `/status` (#283) และ Backend `/status` (#282) live feed — surface พวกนั้นคง "No Data"
- เพิ่ม MIT instrumentation ใหม่ (run-summary detail ราย stage, GPU clock, CPU temp) — panel แสดง "No Data"
- แอปนอก Dashboard (โค้ด Frontend/Backend/MIT) — ไม่แตะ

## Further Notes

- Correctness fix + full redesign + **tech-debt reduction** (label `tech-debt`): net deletes more than it adds.
- `/service/mit` was already de-mocked (live graphs, real x-axis, live panels, functional `mit@console`) in the
  2026-06-17 increment (DONE.md); I4 re-skins it into the new design while keeping the live wiring.
- The Dashboard is **ours** (team split) — no cross-team coordination beyond the #282/#283 dependency.
- Design reference: Finesse UI (https://finesseui.com/) — the `/impeccable` design phase (I2) develops the concrete
  tokens/components from it.

**(ไทย)**
- แก้ correctness + redesign เต็ม + **ลด tech-debt** (label `tech-debt`): สุทธิลบมากกว่าเพิ่ม
- `/service/mit` de-mock ไปแล้ว (กราฟ live, แกนเวลาจริง, panel live, `mit@console` ใช้งานได้) ใน increment 2026-06-17 (DONE.md)
  I4 re-skin ไปดีไซน์ใหม่โดยคง live wiring
- Dashboard เป็น **ของเรา** (team split) ไม่ต้อง coordinate ข้ามทีมนอกจาก dependency #282/#283
- Design reference: Finesse UI (https://finesseui.com/) — design phase `/impeccable` (I2) พัฒนา token/component จริงจากมัน
