<!-- lang:en -->
# PRD: Interactive Flow Simulations in Docs Hub

**Component:** `docs/simulations` · **Owner:** xeno (Frontend) · **Labels:** `ready-for-agent`, `Feature`, `Frontend`
**Status:** Ready for implementation

---

## Problem Statement

The MangaDock Engineering Hub (`/docs`) currently contains written documentation and one interactive cache simulator, but it has no visual simulations of the platform's other core flows (authentication, chapter unlock, real-time SSE, image upload, asset serving). Anyone reading the docs — whether a new team member, a project advisor, or a curious visitor — must mentally reconstruct how requests move through the system from text descriptions and static diagrams alone. This creates a steep comprehension barrier, especially for non-engineers (advisors, stakeholders) who need to understand *what* the system does without needing to understand *how* the code implements it.

---

## Solution

Add a **Simulations** tab to the docs hub containing step-by-step interactive flow diagrams for every major system behavior. Each simulation shows the nodes involved (Browser, Frontend, Backend, MIT, Supabase, Redis, R2, Worker), highlights the active path at each step, and provides a plain-language explanation of what is happening and why. Controls are minimal: Previous / Next / Play auto-advance. No configuration, no code visible, no login required.

The simulations are built on a **generic simulator engine** — a pure function that maps `(scenario, stepIndex) → nodeStates` — so each new flow is data only (nodes + steps), not new React code.

---

## User Stories

1. As a **new team member**, I want to step through the authentication flow interactively, so that I understand how Supabase JWT reaches the backend guard without reading source code.
2. As a **new team member**, I want to see the chapter unlock flow animated, so that I understand why HWID + wallet debit must be atomic and what happens if either fails.
3. As a **new team member**, I want to simulate the image translation pipeline (Cache HIT → R2 HIT → MIT full run), so that I understand when GPU is used and when it is not.
4. As a **project advisor**, I want to see how a user's request travels from browser to database, so that I can assess the system architecture without reading code.
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

A generic React component that accepts `nodes`, `edges`, and `nodeStates: Record<string, NodeState>`. Renders nodes as colored boxes and edges as arrows. Reads `nodeStates` to apply visual classes per `nsClass()`. No animation library — CSS `transition: all 0.35s ease` on each node.

Layout is declarative: nodes are placed on a grid specified in the scenario data (`row`, `col` integers → CSS Grid). This removes hand-crafted flex layouts per scenario.

### SimulatorPanel Component

Wraps `FlowDiagram` with:
- Step counter (`Step N of M`)
- Previous / Next buttons
- Play toggle (auto-advance every 1.8 s, pause on manual click)
- Legend strip (color → state meaning, shown once per panel)
- `descEN` + `descTH` for the active step

### SimulationsView Component

Organises scenarios into domain groups rendered as a two-column accordion sidebar + `SimulatorPanel` main area.

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

### Accessibility

- Each `SimulatorPanel` has an `aria-live="polite"` region for step descriptions.
- Play/Pause button has `aria-label` reflecting current state.
- Node boxes have `role="img"` + `aria-label` with state text.
- Reduced motion: Play auto-advance and CSS transitions are disabled when `prefers-reduced-motion: reduce`.

---

## Testing Decisions

**`simulatorEngine` (unit — pure function)**
- `resolveStep` returns correct `NodeState` for each step in a known scenario
- Nodes not mentioned in a step default to `'idle'`
- Step index out of bounds is clamped (no crash)
- All existing cache scenarios produce the same node states after migration

**`SimulationsView` (integration — fetch SSR output)**
- GET `/docs` with `?sim=<scenarioId>` returns HTTP 200
- HTML contains the scenario's `labelEN` text
- HTML contains the domain group heading for every group

**E2E (MCP Playwright)**
- Clicking "Next" advances the step counter and changes the active node's visual state
- Clicking "Play" auto-advances without user input
- Selecting a different scenario resets to step 0
- `?sim=auth-login` deep-link opens the auth-login scenario directly

---

## Out of Scope

- Live data in simulations — scenarios use hardcoded illustrative data
- Simulation editor UI — scenarios are authored as TypeScript data files
- Mobile-specific layout redesign — diagrams scroll horizontally on narrow viewports
- Localization beyond EN/TH

---

## Further Notes

- The existing `cacheScenarios` in `OverviewView.tsx` is the reference implementation.
- The color convention (`idle / active / ok / err / skip / write`) is already established and should not change.
- Node grid layout (row/col integers) was chosen over absolute pixel positioning.
- `?sim=<scenarioId>` uses `history.replaceState` (not Next.js router) to avoid a full page navigation.
<!-- lang:end -->

<!-- lang:th -->
# PRD: Simulations แบบ Interactive สำหรับ Docs Hub

**Component:** `docs/simulations` · **Owner:** xeno (Frontend) · **Labels:** `ready-for-agent`, `Feature`, `Frontend`
**Status:** พร้อม implement

---

## ปัญหา

Engineering Hub (`/docs`) มีเอกสารและ cache simulator อยู่แล้ว แต่ยังขาด simulation แบบ interactive สำหรับ flow หลักอื่นๆ ของ MangaDock — เช่น การ login, การ unlock chapter, การแพร่กระจายข้อมูล real-time ผ่าน SSE, การ upload รูปภาพ และการ serve asset ในอนาคตผ่าน Cloudflare R2 ผู้ที่อ่าน docs — ไม่ว่าจะเป็นสมาชิกทีมใหม่, อาจารย์ที่ปรึกษา, หรือบุคคลทั่วไป — ต้องสร้างภาพในหัวเองจากข้อความและ diagram นิ่ง ซึ่งเป็นอุปสรรคใหญ่โดยเฉพาะกับผู้ที่ไม่ใช่วิศวกร

---

## วิธีแก้

เพิ่ม tab "Simulations" ใน docs hub ที่มี step-by-step interactive diagram สำหรับทุก flow หลักของ MangaDock แต่ละ simulation แสดง node ที่เกี่ยวข้อง (Browser, Frontend, Backend, MIT, Supabase, Redis, R2, Worker), highlight เส้นทาง active ในแต่ละ step พร้อมคำอธิบายภาษาธรรมดาทั้งภาษาอังกฤษและไทย ควบคุมด้วย Previous / Next / Play เท่านั้น ไม่มี config ไม่มี code ให้เห็น ไม่ต้อง login

สร้างบน **generic simulator engine** — pure function ที่รับ `(scenario, stepIndex) → nodeStates` — ให้แต่ละ flow ใหม่เป็นแค่ข้อมูล (nodes + steps) ไม่ใช่ React code ใหม่

---

## User Stories

1. สมาชิกทีมใหม่ — ต้องการ step through authentication flow เพื่อเข้าใจว่า Supabase JWT ไปถึง backend guard ได้ยังไงโดยไม่อ่าน source code
2. สมาชิกทีมใหม่ — ต้องการเห็น chapter unlock flow แบบ animated เพื่อเข้าใจว่าทำไม HWID + wallet debit ต้องเป็น atomic
3. สมาชิกทีมใหม่ — ต้องการ simulate image translation pipeline (Cache HIT → R2 HIT → MIT full run) เพื่อรู้ว่า GPU ถูกใช้เมื่อไร
4. อาจารย์ที่ปรึกษา — ต้องการเห็น request ของผู้ใช้เดินทางจาก browser ไปยัง database เพื่อประเมินสถาปัตยกรรมระบบ
5. อาจารย์ที่ปรึกษา — ต้องการ step through real-time SSE forum flow เพื่อเข้าใจว่าโพสต์ปรากฏทันทีสำหรับทุกคนที่เชื่อมต่ออยู่ได้ยังไง
6. อาจารย์ที่ปรึกษา — ต้องการเห็น Cloudflare R2 asset distribution flow เปรียบเทียบกับ backend proxy ปัจจุบัน
7. ผู้เยี่ยมชมทั่วไป — ต้องการ explore cache resilience scenarios (L2 ล่ม, L2+L3 ล่ม)
8. ผู้เยี่ยมชมทั่วไป — ต้องการเข้าใจว่า manga translation ทำงานอย่างไร ตั้งแต่คลิกหน้าจนเห็นข้อความที่แปลแล้ว
9. สมาชิกทีม — ต้องการเห็น upload pipeline validate รูปภาพก่อน storage
10. สมาชิกทีม — ต้องการเห็น leader election และ leader-crash recovery flow ใน cache write path
11. สมาชิกทีม — ต้องการ simulation จัดกลุ่มตาม domain (Auth, Cache, Translation, Real-Time, Assets, Upload)
12. สมาชิกทีม — ต้องการแต่ละ step แสดงคำอธิบายภาษาไทยควบคู่ภาษาอังกฤษ
13. ผู้ใช้มือถือ — ต้องการ diagram พอดีกับหน้าจอโดยไม่ต้อง scroll แนวนอน
14. สมาชิกทีมที่เขียน simulation ใหม่ — ต้องการกำหนดเป็น data object (nodes + steps) ไม่ใช่ React component ใหม่
15. สมาชิกทีม — ต้องการปุ่ม Play auto-advance steps โดยไม่ต้องคลิกเอง
16. อาจารย์ที่ปรึกษา — ต้องการ legend อธิบาย node color states
17. สมาชิกทีมใหม่ — ต้องการ SSE stream simulation แสดงสิ่งที่เกิดขึ้นเมื่อ client disconnect และ reconnect
18. ผู้เยี่ยมชมทั่วไป — ต้องการหน้า landing ของ docs hub แสดง simulations เป็นจุดเข้าถึงหลัก
19. สมาชิกทีม — ต้องการ deep-link แต่ละ simulation ด้วย scenario ID (เช่น `?sim=auth-login`)

---

## Scenario ที่จะมี

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

---

## การทดสอบ

- **Unit tests** (pure function): `simulatorEngine` ทดสอบด้วย `node:test` + `npx tsx` — ไม่ต้องติดตั้งอะไรเพิ่ม
- **Integration tests** (SSR): ตรวจ HTML output ด้วย `fetch` ว่ามี scenario label ครบ
- **E2E** (MCP Playwright): ตรวจ Next/Play button, deep-link, sidebar navigation

---

## นอกขอบเขต

- ข้อมูล live จาก production ใน simulation
- GUI editor สำหรับสร้าง scenario ใหม่
- Layout พิเศษสำหรับ mobile (scroll horizontal เหมือน simulator เดิม)
- ภาษาอื่นนอกจาก EN/TH
<!-- lang:end -->
