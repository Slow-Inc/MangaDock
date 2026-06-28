# ADR 021 — Deployment & cost architecture: ephemeral on-demand 2-tier, deferred until validated

> **TL;DR (ภาษาไทย — กันลืม):** Deploy จริงตอน **Final/เทอม 2 (present)** บน **2-tier: MIT → serverless GPU cloud (per-time, ตื่นตาม request) · FE/BE/Redis → VPS ที่เช่าอยู่แล้ว**. เทอม 1 ทำ **alpha deploy แบบ ephemeral** (เปิดแก้บั๊ก → ปิดตอนไม่ใช้ → เปิดใหม่ตอน present). **Marginal cost ≈ 0** (GPU per-time, VPS sunk/shared, R2 free tier, LLM = 9arm Qwen3.6-35B ใน YouTube subscription ไม่ใช่ Gemini per-request). State อยู่ที่ Supabase + R2 → ปิด compute ได้ข้อมูลไม่หาย. ก่อน deploy ต้องผ่าน **final system test**. ตอน present ต้อง **pre-warm GPU + มี fallback LLM + cached demo**.

- **Status:** Accepted (2026-06-28) — **planned** (not yet deployed; deliberately deferred). Realizes the "On-Demand AI Pipeline" of [ADR 018]-era architecture + Roadmap Phase 2 "MIT GPU Cloud Migration." Uses the storage seam of [ADR 001](001-cloudflare-r2-storage.md) (R2).
- **Context:** advisor timeline — main systems done in term 1, deploy + present in term 2. The team asked to record this so it isn't forgotten.

## Context

The system is **pre-alpha** (Roadmap Phases 0–1.5 done; Phase 2 partial). Cloud deployment is the weakest maturity axis — *by deliberate choice*, not oversight. Two questions had to be settled: **when** to deploy, and **on what** (at what cost). Both were resolved in planning and must be captured because the deployment specifics did not previously exist in any single MD (only a one-line "GPU Cloud Migration" in `Roadmap.md` and a `Local/VPS` label in the `UML_REPORT.md` diagram that incorrectly lumped MIT onto the VPS).

## Decision

**1. Two-tier target topology.**
- **MIT (GPU inference) → serverless GPU cloud** billed **per-time**, **woken only on request** (e.g. RunPod / Vast.ai / Modal class — exact provider TBD). Idle = paying nothing for compute.
- **Frontend + Backend + Redis → a VPS** the team **already rents** for other projects → **marginal cost ≈ 0** (sunk/shared).
- **State lives outside the compute** so it survives spin-down: **Supabase** (Auth + PostgreSQL) and **Cloudflare R2** (uploads/patches, via the ADR 001 `StorageProvider`). Nothing is on the VPS's local disk that would be lost on destroy/recreate.

**2. Ephemeral, on-demand operation.**
- **Term 1:** an **alpha deploy** — spin up to fix deploy-environment bugs (env/CORS/networking/cold-start that don't appear locally), **spin down when idle**, spin up again as needed. Cheap because of the cost model above.
- **Term 2 (presentation):** spin the stack back up for the live demo / production run.
- This is genuine on-demand: pay for compute only when actually used.

**3. Deploy is gated behind a final-validation milestone.**
- Production deploy happens **only after final system testing** (E2E / UAT / load) passes — to avoid post-go-live incidents. "Deploy then discover" is explicitly rejected.

**4. Cost model (the reason early deploy is low-risk).**
| Component | Billing | Marginal cost |
|---|---|---|
| GPU (MIT) | serverless per-time, wake-on-request | ~0 when idle |
| VPS (FE/BE/Redis) | already rented for other projects | 0 (sunk) |
| R2 (storage) | free tier (sufficient for dev/demo) | 0 |
| LLM (translation) | **9arm Qwen3.6-35B** via `custom_openai` gateway, included in the team's monthly **YouTube subscription/donation** — **NOT** Gemini per-request | 0 |
| Supabase | free/existing tier | 0 |

→ The whole system runs on **costs the team already pays**. The earlier "defer to save cost" rationale is now secondary; the primary reason to defer is **validate-first + pre-alpha**, not money.

**5. Push-button deploy.** Spin-up must be a **script / docker-compose / IaC** one-shot (the repo already has Dockerfiles + compose) so "open it again for the presentation" is reliable, not a manual scramble in front of examiners.

## Demo-day reliability checklist (the risk moved from $ → live-demo failure)

- [ ] **Pre-warm the GPU** before presenting — first request after wake is slow (model-weight load, 30 s–minutes). Fire a warm-up request, or keep weights on a persistent volume.
- [ ] **Fallback LLM** — 9arm is a community/donation gateway with **no SLA you control**. If it's down/rate-limited mid-demo, translation fails. Keep a **Gemini free-tier key** standby and/or a **cached/pre-translated** demo chapter.
- [ ] **Know the R2 free-tier limits** (storage/egress) so a many-page demo doesn't hit the cap.
- [ ] **Cached happy-path demo** + screen-recording backup (fresh translation is ~35 s/page; pre-warm a cached example).

## Alternatives considered

| Option | Verdict |
|---|---|
| **Serverless per-time GPU (wake-on-request)** | **chosen** — pay only when translating; matches the on-demand architecture. |
| Always-on GPU instance | rejected — pays 24/7 for a pre-alpha system with no users. |
| **FE/BE on the already-rented VPS** | **chosen** — zero marginal cost. |
| Managed PaaS (Vercel/Fly/Cloud Run) for FE/BE | deferred — fine later, but the shared VPS is free to us now. |
| Deploy everything to cloud now (term 1, always-on) | rejected — burns cost + skips the validation gate; contradicts pre-alpha status. |
| Keep uploads on VPS local disk | rejected — spin-down/destroy would lose data; R2 externalizes state. |
| Gemini API (per-request paid) as the production translator | not chosen for cost — 9arm Qwen is $0; Gemini kept as a **fallback** only. |

## Consequences

- **Positive:** near-zero-cost, genuinely on-demand deployment running on already-paid infrastructure; state externalized (Supabase + R2) so spin-up/down is clean; a strong, honest **cost-architecture story** for the viva; deploying an alpha early is now **low-risk** (no real cost downside) and de-risks the term-2 production deploy.
- **Negative / watch:** GPU **cold-start latency** on wake (mitigate: pre-warm / persistent weights); **single-LLM dependency on a donation service** with no SLA (mitigate: fallback key + cached demo); free-tier R2/Supabase ceilings; deployment is **still ⭐⭐ (not deployed)** — but now by *documented, deliberate* choice, not omission.
- **Revisit trigger:** when final system testing passes and a public alpha / presentation is due (term 2), execute the deploy; revisit always-on GPU only if real sustained traffic appears.
- **Provenance:** consolidates the deployment intent previously scattered across `Roadmap.md` (Phase 2), `Documents/SYSTEM_ARCHITECTURE_OVERVIEW.md`, and the `UML_REPORT.md` deployment diagram (which this ADR also corrects to a 2-tier GPU-cloud/VPS split). Cost facts captured from team planning, 2026-06-28.
