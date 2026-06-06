# PRD: Interactive Flow Simulations in Docs Hub

**Component:** `docs/simulations` · **Owner:** xeno (Frontend) · **Labels:** `ready-for-agent`, `Feature`, `Frontend`
**Status:** Ready for implementation

---

## Problem Statement

The MangaDock Engineering Hub (`/docs`) currently contains written documentation and one interactive cache simulator, but it has no visual simulations of the platform's other core flows (authentication, chapter unlock, real-time SSE, image upload, asset serving). Anyone reading the docs — whether a new team member, a project advisor, or a curious visitor — must mentally reconstruct how requests move through the system from text descriptions and static diagrams alone. This creates a steep comprehension barrier, especially for non-engineers (advisors, stakeholders) who need to understand *what* the system does without needing to understand *how* the code implements it.

**ปัญหา:** Engineering Hub มี docs และ cache simulator แต่ยังขาด simulation สำหรับ flow หลักอื่นๆ (auth, unlock, SSE, upload, asset serving) ทำให้ผู้อ่าน — ไม่ว่าจะเป็นสมาชิกทีมใหม่, อาจารย์ที่ปรึกษา, หรือบุคคลทั่วไป — ต้องสร้างภาพการทำงานในหัวจากข้อความและ diagram นิ่งเพียงอย่างเดียว ซึ่งเป็นอุปสรรคสำคัญสำหรับผู้ที่ไม่ใช่วิศวกร

---

## Solution

Add a **Simulations** tab to the docs hub containing step-by-step interactive flow diagrams for every major system behavior. Each simulation shows the nodes involved (Browser, Frontend, Backend, MIT, Supabase, Redis, R2, Worker), highlights the active path at each step, and provides a plain-language explanation of what is happening and why. Controls are minimal: Previous / Next / Play auto-advance. No configuration, no code visible, no login required.

The simulations are built on a **generic simulator engine** — a pure function that maps `(scenario, stepIndex) → nodeStates` — so each new flow is data only (nodes + steps), not new React code.

**วิธีแก้:** เพิ่ม tab "Simulations" ใน docs hub ที่มี step-by-step interactive diagram สำหรับทุก flow หลัก แต่ละ simulation แสดง node ที่เกี่ยวข้อง, highlight เส้นทาง active ในแต่ละ step และอธิบายเป็นภาษาธรรมดาว่าเกิดอะไรขึ้นและทำไม ใช้ simulator engine แบบ generic (pure function) ให้แต่ละ flow ใหม่เป็นแค่ข้อมูล (nodes + steps) ไม่ใช่ React code ใหม่

---

## User Stories

1. As a **new team member**, I want to step through the authentication flow interactively, so that I understand how Supabase JWT reaches the backend guard without reading source code.
2. As a **new team member**, I want to see the chapter unlock flow animated, so that I understand why HWID + wallet debit must be atomic and what happens if either fails.
3. As a **new team member**, I want to simulate the image translation pipeline (Cache HIT → R2 HIT → MIT full run), so that I understand when GPU is used and when it is not.
4. As a **project advisor (อาจารย์ที่ปรึกษา)**, I want to see how a user's request travels from browser to database, so that I can assess the system architecture without reading code.
5. As a **project advisor**, I want to step through the real-time SSE forum flow, so that I understand how posts appear instantly for all connected users.
6. As a **project advisor**, I want to see the planned Cloudflare R2 asset distribution flow compared to the current backend proxy, so that I understand Phase 2 infrastructure improvements.
7. As a **general visitor**, I want to explore the cache resilience scenarios (L2 down, L2+L3 down), so that I understand that the system stays up even when components fail.
8. As a **general visitor**, I want to understand how manga translation works at a high level — from clicking a page to seeing translated text — without needing to know what a GPU or HMAC is.
9. As a **team member**, I want to see how the upload pipeline validates images before storage, so that I understand why extension checks alone are insufficient and how magic-byte MIME validation works.
10. As a **team member**, I want to see the leader election and leader-crash recovery flow in the cache write path, so that I can explain to a new member why no data is lost when a node crashes.
11. As a **team member**, I want simulations to be grouped by domain (Auth, Cache, Translation, Real-Time, Assets, Upload), so that I can find the relevant simulation quickly without scrolling through all of them.
12. As a **team member**, I want each simulation step to show a plain-Thai description alongside the English one, so that Thai-speaking stakeholders and advisors can follow without translation.
13. As a **mobile user**, I want the simulation diagrams to fit a phone screen without horizontal scrolling (or scroll gracefully), so that I can review flows on the go.
14. As a **team member writing a new simulation**, I want to define it as a data object (nodes + steps), not as new React components, so that adding a new flow takes minutes not hours.
15. As a **team member**, I want the Play button to auto-advance steps with a configurable interval, so that I can present a simulation in a demo without clicking manually.
16. As a **project advisor**, I want a legend explaining node color states (active, ok, error, skip, writing), so that I can interpret the diagrams without prior context.
17. As a **new team member**, I want the SSE stream simulation to show what happens when a client disconnects and reconnects with exponential backoff, so that I understand the resilience of the real-time system.
18. As a **general visitor**, I want the docs hub landing page to show the simulations as a prominent entry point, so that I encounter interactivity before walls of text.
19. As a **team member**, I want each simulation to deep-link by scenario ID (e.g. `?sim=auth-login`), so that I can share a specific simulation step with a teammate or advisor.

---

## Implementation Decisions

### Generic Simulator Engine

Extract a pure `simulatorEngine` module (no React, no DOM) with a single function:

```ts
type NodeState = 'idle' | 'active' | 'ok' | 'err' | 'skip' | 'write';

interface SimNode { id: string; label: string; sub?: string }
interface SimEdge { from: string; to: string; label?: string }
interface SimStep { descEN: string; descTH: string; states: Record<string, NodeState> }
interface SimScenario { id: string; labelEN: string; labelTH: string; badge: string; nodes: SimNode[]; edges: SimEdge[]; steps: SimStep[] }

function resolveStep(scenario: SimScenario, stepIndex: number): Record<string, NodeState>
// Returns node states for the given step — all unmentioned nodes default to 'idle'
```

This is the only module that needs unit tests. It has no dependencies (pure data → data) and encodes the whole stateful logic of the simulator.

### FlowDiagram Component

A generic React component that accepts `nodes`, `edges`, and `nodeStates: Record<string, NodeState>`. Renders nodes as colored boxes and edges as arrows. Reads `nodeStates` to apply visual classes per `nsClass()` (same color convention as the existing cache simulator). No animation library — CSS `transition: all 0.35s ease` on each node, matching what is already in `OverviewView.tsx`.

Layout is declarative: nodes are placed on a grid specified in the scenario data (`row`, `col` integers → CSS Grid). This removes hand-crafted flex layouts per scenario.

### SimulatorPanel Component

Wraps `FlowDiagram` with:
- Step counter (`Step N of M`)
- Previous / Next buttons
- Play toggle (auto-advance every 1.8 s, pause on manual click)
- Legend strip (color → state meaning, shown once per panel)
- `descEN` + `descTH` for the active step, `descEN` as heading, `descTH` as secondary

Step state lives in `useState<number>`. No global state, no context.

### SimulationsView Component (new top-level view)

Replaces the scattered simulation code in `OverviewView.tsx`. Organises scenarios into domain groups rendered as a two-column accordion sidebar + `SimulatorPanel` main area. Groups:

| Domain | Scenarios |
|--------|-----------|
| Cache — Read | L1 HIT, L2 HIT, Full Miss, L2 Down, L2+L3 Down |
| Cache — Write | Leader Election, Leader Crash |
| Translation | Cache HIT, R2 HIT, MIT Full Run |
| Auth | Login (Google OAuth), JWT validation, Token refresh |
| Chapter Unlock | Happy path, HWID mismatch, Insufficient coins |
| Real-Time (SSE) | Forum post broadcast, Client reconnect (backoff) |
| Asset Serving | Current (Backend proxy), Phase 2 (R2 edge + Worker) |
| Upload | Valid image, Extension spoof (magic-byte reject) |

**Migration**: existing `cacheScenarios` data in `OverviewView.tsx` is converted to the new `SimScenario[]` format and moved to a `simulations/data/cache.ts` data file. `OverviewView.tsx` keeps its static diagrams; the interactive simulator moves to `SimulationsView`.

### DocsClient ViewState extension

Add `{ type: 'simulations'; scenarioId?: string }` to `ViewState`. The sidebar gains a "Simulations" entry. URL param `?sim=<scenarioId>` sets the initial scenario on page load and is updated on scenario change (no full navigation, just `history.replaceState`).

### Scenario data files

One file per domain group under `app/docs/simulations/data/`:
- `cache.ts` (migrated from OverviewView)
- `auth.ts`
- `unlock.ts`
- `sse.ts`
- `assets.ts`
- `upload.ts`

Each exports `SimScenario[]`. The domain index `app/docs/simulations/data/index.ts` re-exports all groups with their display labels. This is the only file touched when adding a new scenario.

### Accessibility

- Each `SimulatorPanel` has an `aria-live="polite"` region for step descriptions — screen readers announce each step.
- Play/Pause button has `aria-label` reflecting current state.
- Node boxes have `role="img"` + `aria-label` with state text.
- Reduced motion: Play auto-advance and CSS transitions are disabled when `prefers-reduced-motion: reduce`.

---

## Testing Decisions

A good test for this feature verifies **external behavior** — what the user observes — not internal component structure. Tests should not assert on CSS class names, DOM node counts, or which sub-component is rendered. They should assert on what the user sees: descriptions change, node states change, step counter increments.

### What will be tested

**`simulatorEngine` (unit — pure function, `node:test` + `npx tsx`)**
- `resolveStep` returns correct `NodeState` for each step in a known scenario
- Nodes not mentioned in a step default to `'idle'`
- Step index out of bounds is clamped (no crash)
- All 9 existing cache scenarios produce the same node states they produce today (regression guard against the migration)

**`SimulationsView` (integration — fetch SSR output, `node:test` + `npx tsx`)**
- GET `/docs` with `?sim=<scenarioId>` returns HTTP 200
- HTML contains the scenario's `labelEN` text
- HTML contains the domain group heading for every group

**E2E (MCP Playwright — interactive verification)**
- Clicking "Next" advances the step counter and changes the active node's visual state
- Clicking "Play" auto-advances without user input
- Selecting a different scenario from the sidebar resets to step 0
- `?sim=auth-login` deep-link opens the auth-login scenario directly

### Prior art

- `utils.test.ts` — pure function unit tests with `node:test` + `npx tsx` (same runner, no new deps)
- `docs.integration.test.ts` — SSR HTML assertions with `fetch` against `:4000`
- MCP Playwright sessions used for E2E verification in this session (same approach)

---

## Out of Scope

- **Live data in simulations** — scenarios use hardcoded illustrative data, not real production traces. Showing actual Redis latency or real JWT payloads is a separate observability feature.
- **Simulation editor UI** — a GUI for building new scenarios is out of scope; scenarios are authored as TypeScript data files.
- **Mobile-specific layout redesign** — diagrams scroll horizontally on narrow viewports (same as the existing cache simulator). A dedicated mobile layout is future work.
- **Localization beyond EN/TH** — each step carries `descEN` and `descTH`; other languages are not in scope.
- **Performance/error scenario simulation for MIT** — MIT timeout, inpainter failure, and OCR error paths are not in scope for this iteration.

---

## Further Notes

- The existing `cacheScenarios` in `OverviewView.tsx` is the reference implementation. The generic engine must produce identical visual output for all 9 existing scenarios after migration — use the unit test regression suite to verify this before deleting the old code.
- The color convention (`idle / active / ok / err / skip / write` → amber / emerald / red / indigo) is already established and should not change — it appears in the existing `nsClass()` helper and in the legend.
- Node grid layout (row/col integers) was chosen over absolute pixel positioning to make scenarios responsive and authoring simple. The `FlowDiagram` component translates `(row, col)` to `grid-row` / `grid-column` CSS.
- `?sim=<scenarioId>` uses `history.replaceState` (not Next.js router) to avoid a full page navigation on each scenario change, keeping the simulator snappy.

---

## สรุปภาษาไทย

### ปัญหา

Engineering Hub (`/docs`) มีเอกสารและ cache simulator อยู่แล้ว แต่ยังขาด simulation แบบ interactive สำหรับ flow หลักอื่นๆ ของ MangaDock — เช่น การ login, การ unlock chapter, การแพร่กระจายข้อมูล real-time ผ่าน SSE, การ upload รูปภาพ และการ serve asset ในอนาคตผ่าน Cloudflare R2 ผู้ที่อ่าน docs — ไม่ว่าจะเป็นสมาชิกทีมใหม่, อาจารย์ที่ปรึกษา, หรือบุคคลทั่วไป — ต้องสร้างภาพในหัวเองจากข้อความและ diagram นิ่ง ซึ่งเป็นอุปสรรคใหญ่โดยเฉพาะกับผู้ที่ไม่ใช่วิศวกร

### วิธีแก้

เพิ่ม tab "Simulations" ใน docs hub ที่มี step-by-step interactive diagram สำหรับทุก flow หลักของ MangaDock แต่ละ simulation แสดง node ที่เกี่ยวข้อง (Browser, Frontend, Backend, MIT, Supabase, Redis, R2, Worker), highlight เส้นทาง active ในแต่ละ step พร้อมคำอธิบายภาษาธรรมดาทั้งภาษาอังกฤษและไทย ควบคุมด้วย Previous / Next / Play เท่านั้น ไม่มี config ไม่มี code ให้เห็น ไม่ต้อง login

สร้างบน **generic simulator engine** — pure function ที่รับ `(scenario, stepIndex) → nodeStates` — ให้แต่ละ flow ใหม่เป็นแค่ข้อมูล (nodes + steps) ไม่ใช่ React code ใหม่ ทำให้เพิ่ม scenario ใหม่ได้ในเวลาไม่กี่นาที

### Scenario ที่จะมี

| Domain | จำนวน Scenario |
|--------|---------------|
| Cache — Read | 5 (L1 HIT, L2 HIT, Full Miss, L2 Down, L2+L3 Down) |
| Cache — Write | 2 (Leader Election, Leader Crash) |
| Translation | 3 (Cache HIT, R2 HIT, MIT Full Run) |
| Auth | 3 (Login OAuth, JWT validation, Token refresh) |
| Chapter Unlock | 3 (Happy path, HWID mismatch, ไม่มีเหรียญ) |
| Real-Time (SSE) | 2 (Forum broadcast, Client reconnect) |
| Asset Serving | 2 (ปัจจุบัน backend proxy, Phase 2 R2 edge) |
| Upload | 2 (รูปถูก, Extension spoof ถูก reject) |

### การทดสอบ

- **Unit tests** (pure function): `simulatorEngine` ทดสอบด้วย `node:test` + `npx tsx` — ไม่ต้องติดตั้งอะไรเพิ่ม
- **Integration tests** (SSR): ตรวจ HTML output ด้วย `fetch` ว่ามี scenario labels ครบ
- **E2E** (MCP Playwright): ตรวจ Next/Play button, deep-link, sidebar navigation

### นอกขอบเขต

- ข้อมูล live จาก production ใน simulation
- GUI editor สำหรับสร้าง scenario ใหม่
- Layout พิเศษสำหรับ mobile (scroll horizontal เหมือน simulator เดิม)
- ภาษาอื่นนอกจาก EN/TH
