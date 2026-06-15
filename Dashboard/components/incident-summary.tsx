"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Loader2, RotateCw, ArrowRight, ChevronDown } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { SERVICES, NODE_LOGS } from "@/lib/services";
import { LEVEL_COLOR } from "@/lib/log";

const ACCENT = "var(--c-ocr)"; // violet — the "AI" identity
const EASE = [0.16, 1, 0.3, 1] as const;

// Signals the model synthesises across (feature names — kept as-is across languages).
const SIGNALS = ["Gateway diagnosis", "Translate queue", "Stage timing", "Subsystems", "Streams", "Node logs"];
const META = { confidence: 92, model: "qwen3.6-35b-a3b", latencyMs: 1840 };
const BLOCK_DOTS = ["var(--error)", "var(--processing)", "var(--success)"];

// The model reads actual logs across services AND each backend node for grounding — pulled from
// the same data the panels show, prioritising error → warn → info (most relevant first).
const SERVICE_LOGS = SERVICES.flatMap((s) => s.logs.map((l) => ({ source: s.name, ...l })));
const NODE_LOG_ENTRIES = Object.entries(NODE_LOGS).flatMap(([id, logs]) => logs.map((l) => ({ source: id, ...l })));
const ALL_LOGS = [...SERVICE_LOGS, ...NODE_LOG_ENTRIES];
const byLevel = (lv: string) => ALL_LOGS.filter((l) => l.level === lv);
const EVIDENCE = [...byLevel("error"), ...byLevel("warn"), ...byLevel("info")].slice(0, 6);
const LOG_COUNT = ALL_LOGS.length;
const SERVICE_COUNT = SERVICES.length;
const NODE_COUNT = Object.keys(NODE_LOGS).length;

type Lang = "en" | "th";

// Mock triage in both languages. Real call: POST /api/summarize re-runs qwen3.6 · 9arm
// in the chosen language; the panel shape stays identical.
const L10N: Record<Lang, {
  idlePre: string;
  idleBold: string;
  idlePost: string;
  summarize: string;
  loading: string;
  confidence: string;
  signals: string;
  evidence: string;
  advisory: string;
  discord: string;
  regenerate: string;
  blocks: { label: string; text: string }[];
}> = {
  en: {
    idlePre: "",
    idleBold: "1 active incident",
    idlePost: ` detected across ${SIGNALS.length} signals.`,
    summarize: "Summarize incident",
    loading: `Reading ${SIGNALS.length} signals · ${LOG_COUNT} log lines across ${SERVICE_COUNT} services + ${NODE_COUNT} nodes…`,
    confidence: `high confidence · ${META.confidence}%`,
    signals: "signals used",
    evidence: `Evidence · ${EVIDENCE.length} log lines read`,
    advisory: "AI-generated · advisory — verify against the panels below",
    discord: "Send to Discord",
    regenerate: "Regenerate",
    blocks: [
      { label: "Root cause", text: "MIT's translate stage is failing. The 9arm gateway control plane is healthy (GET /models → 200 in 0.19s) but the data plane is hung — completions to qwen3.6-35b-a3b timed out 3× (40 / 60 / 80s). The inference backend is unresponsive, not the gateway." },
      { label: "Impact", text: "Pipeline stalled at stage 3/5. 1 job stuck 90s (One-Punch · ch1 · p3), 3 queued and growing. Backend node be-c0e5f2 lost its election lease (stale, re-syncing L1 from L3) — quorum holds via leader be-7f3a9c. Frontend, Redis, Supabase, R2 nominal; no user-facing data loss (patches cache-backed)." },
      { label: "Recommended action", text: "Restart the qwen3.6 worker on the 9arm host — a plain retry will fail because the live /models endpoint masks the dead inference process. Probe with a 16-token completion before re-enabling the queue. Track L3 disk separately (degraded, growing unbounded)." },
    ],
  },
  th: {
    idlePre: "พบ ",
    idleBold: "1 incident ที่กำลังเกิด",
    idlePost: ` จาก ${SIGNALS.length} signal`,
    summarize: "สรุป incident",
    loading: `กำลังอ่าน ${SIGNALS.length} signal · log ${LOG_COUNT} บรรทัด จาก ${SERVICE_COUNT} service + ${NODE_COUNT} node…`,
    confidence: `มั่นใจสูง · ${META.confidence}%`,
    signals: "signal ที่ใช้",
    evidence: `หลักฐาน · log ${EVIDENCE.length} บรรทัดที่อ่าน`,
    advisory: "AI สร้าง · เป็นคำแนะนำ — ตรวจกับ panel ด้านล่างด้วย",
    discord: "ส่งเข้า Discord",
    regenerate: "สร้างใหม่",
    blocks: [
      { label: "สาเหตุหลัก", text: "stage translate ของ MIT กำลัง fail — control plane ของ 9arm gateway ปกติ (GET /models → 200 ใน 0.19s) แต่ data plane ค้าง: completion ไป qwen3.6-35b-a3b timeout 3 ครั้ง (40 / 60 / 80s) ตัว inference backend ไม่ตอบ ไม่ใช่ gateway" },
      { label: "ผลกระทบ", text: "pipeline ค้างที่ stage 3/5 · 1 job ค้าง 90s (One-Punch · ch1 · p3) อีก 3 รอคิว · node be-c0e5f2 ของ Backend เสีย election lease (stale กำลัง re-sync L1 จาก L3) — quorum ยังอยู่ผ่าน leader be-7f3a9c · Frontend, Redis, Supabase, R2 ปกติ — ไม่มีข้อมูลฝั่งผู้ใช้หาย (patch มี cache)" },
      { label: "สิ่งที่ควรทำ", text: "restart worker qwen3.6 บนเครื่อง 9arm — retry เปล่าๆ จะ fail เพราะ /models ที่ยังขึ้นบังว่า process inference ตายแล้ว · probe ด้วย completion 16 token ก่อนเปิดคิวใหม่ · เฝ้า L3 disk แยกต่างหาก (degraded โตไม่จำกัด)" },
    ],
  },
};

type Phase = "idle" | "loading" | "done";

export function IncidentSummary() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [showEvidence, setShowEvidence] = useState(false);
  const { lang, t } = useLang();
  const c = L10N[lang];

  function run() {
    setPhase("loading");
    setTimeout(() => setPhase("done"), 1600);
  }

  return (
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5" style={{ borderBottom: phase === "done" ? "1px solid var(--panel-hairline)" : "none" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklch, ${ACCENT} 16%, transparent)` }}>
            <Sparkles size={13} strokeWidth={2} style={{ color: ACCENT }} />
          </span>
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            {t("incident.title")}
          </h2>
          <span className="rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide" style={{ background: `color-mix(in oklch, ${ACCENT} 14%, transparent)`, color: ACCENT }}>
            AI · advisory
          </span>
        </div>
        <span className="tnum text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>qwen3.6 · 9arm</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-[12.5px]" style={{ color: "var(--panel-ink-2)" }}>
              {c.idlePre}
              <span className="font-semibold" style={{ color: "var(--error)" }}>{c.idleBold}</span>
              {c.idlePost}
            </p>
            <button
              onClick={run}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition-transform hover:-translate-y-px"
              style={{ background: ACCENT, color: "#0a0612" }}
            >
              <Sparkles size={13} /> {c.summarize}
            </button>
          </motion.div>
        )}

        {phase === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="px-5 py-4">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" style={{ color: ACCENT }} />
              <span className="text-[12px]" style={{ color: "var(--panel-ink-2)" }}>{c.loading}</span>
            </div>
            <div className="mt-3 space-y-2">
              {[92, 70, 84].map((w, i) => (
                <div key={i} className="h-2.5 animate-pulse rounded-full" style={{ width: `${w}%`, background: "var(--panel-2)" }} />
              ))}
            </div>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div key={`done-${lang}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="flex items-center justify-between gap-3 px-5 pt-3.5">
              <span className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5" style={{ background: "color-mix(in oklch, var(--success) 14%, transparent)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
                <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--success)" }}>{c.confidence}</span>
              </span>
              <span className="tnum text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>{META.model} · {(META.latencyMs / 1000).toFixed(1)}s</span>
            </div>

            <div className="px-5 py-3">
              {c.blocks.map((b, i) => (
                <div key={b.label} className="flex gap-2.5 py-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BLOCK_DOTS[i] }} />
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{b.label}</div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "var(--panel-ink)" }}>{b.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 pb-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{c.signals}</div>
              <div className="flex flex-wrap gap-1.5">
                {SIGNALS.map((s) => (
                  <span key={s} className="rounded-md px-2 py-1 text-[10.5px]" style={{ background: "var(--panel-2)", color: "var(--panel-ink-2)", border: "1px solid var(--panel-hairline)" }}>{s}</span>
                ))}
              </div>
            </div>

            {/* evidence — actual log lines the summary is grounded on */}
            <div className="px-5 pb-2">
              <button onClick={() => setShowEvidence((v) => !v)} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide transition-colors" style={{ color: "var(--panel-ink-3)" }}>
                <ChevronDown size={11} style={{ transform: showEvidence ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                {c.evidence}
              </button>
              <AnimatePresence initial={false}>
                {showEvidence && (
                  <motion.div key="evidence" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
                    <div className="mt-2 overflow-hidden rounded-lg" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
                      {EVIDENCE.map((l, i) => (
                        <div key={i} className="flex items-baseline gap-2.5 px-3 py-1.5" style={{ borderTop: i ? "1px solid var(--panel-hairline)" : "none" }}>
                          <span className="tnum w-[50px] shrink-0 text-[10px]" style={{ color: "var(--panel-ink-3)" }}>{l.t}</span>
                          <span className="w-[40px] shrink-0 rounded px-1 text-center text-[9px] font-bold uppercase" style={{ background: `color-mix(in oklch, ${LEVEL_COLOR[l.level]} 16%, transparent)`, color: LEVEL_COLOR[l.level] }}>{l.level}</span>
                          <span className="w-[62px] shrink-0 truncate text-[10.5px]" style={{ color: "var(--panel-ink-2)" }}>{l.source}</span>
                          <span className="tnum flex-1 text-[11px] leading-snug" style={{ color: "var(--panel-ink)" }}>{l.msg}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2" style={{ borderTop: "1px solid var(--panel-hairline)" }}>
              <span className="text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>{c.advisory}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => alert("→ POST to Discord (Phase 2)")} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors hover:opacity-80" style={{ color: "var(--panel-ink-2)", border: "1px solid var(--panel-hairline)" }}>
                  {c.discord} <ArrowRight size={12} />
                </button>
                <button onClick={run} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors hover:opacity-80" style={{ color: ACCENT, border: `1px solid color-mix(in oklch, ${ACCENT} 30%, transparent)` }}>
                  <RotateCw size={12} /> {c.regenerate}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
