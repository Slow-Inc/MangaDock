"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Server, Crown, Cpu, HardDrive, ScrollText } from "lucide-react";
import { gen, seedOf } from "@/lib/series";
import { TimeChart, type ChartMetric } from "@/components/time-chart";
import { type NodeHealth, type NodeStatus } from "@/lib/cluster";
import { formatAge } from "@/lib/cache-tiers";
import { LEVEL_COLOR } from "@/lib/log";
import { CACHE_TIERS, BANDWIDTH_NODES, NODE_META, NODE_HARDWARE, NODE_LOGS, CLUSTER_NOW } from "@/lib/services";

const EASE = [0.16, 1, 0.3, 1] as const;
const HEALTH_COLOR: Record<NodeHealth, string> = { up: "var(--success)", stale: "var(--processing)", down: "var(--error)" };
const fmtBytes = (b: number) => (b / 1e6 >= 1000 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`);

export function NodeDetailModal({ node, leaderId, onClose }: { node: NodeStatus | null; leaderId: string | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {node && <NodeDetailBody key={node.id} node={node} leaderId={leaderId} onClose={onClose} />}
    </AnimatePresence>
  );
}

function NodeDetailBody({ node, leaderId, onClose }: { node: NodeStatus; leaderId: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sc = HEALTH_COLOR[node.status];
  const isLeader = node.id === leaderId;
  const cache = CACHE_TIERS.nodes.find((n) => n.nodeId === node.id);
  const bw = BANDWIDTH_NODES.find((n) => n.nodeId === node.id);
  const meta = NODE_META[node.id];
  const seed = seedOf(node.id);
  const bwBase = bw?.down ?? 12;
  const latBase = meta?.p50 ?? 30;
  const nodeLog = NODE_LOGS[node.id] ?? [];

  const charts: ChartMetric[] = [
    { key: `${node.id}-cpu`, title: "CPU Usage", unit: "%", color: "var(--success)", dec: 0, domain: [0, 100], data: gen(40, 18, { phase: seed, min: 8, max: 94 }) },
    { key: `${node.id}-clk`, title: "CPU Clock", unit: "GHz", color: "var(--frontend)", dec: 1, domain: [2.5, 4], data: gen(3.2, 0.45, { phase: seed + 1, spike: 0.5, dec: 1, min: 2.6, max: 3.9 }) },
    { key: `${node.id}-pwr`, title: "Power Draw", unit: "W", color: "var(--processing)", dec: 0, domain: [0, 260], data: gen(140, 55, { phase: seed, spike: 0.5, min: 70, max: 240 }) },
    { key: `${node.id}-ram`, title: "RAM", unit: "GB", color: "var(--c-ocr)", dec: 0, domain: [0, 128], data: gen(58, 14, { phase: seed + 2, min: 34, max: 104 }) },
    { key: `${node.id}-bw`, title: "Bandwidth ↓", unit: "Mbps", color: "var(--c-render)", dec: 0, domain: [0, Math.max(10, bwBase * 2)], data: gen(bwBase, bwBase * 0.4, { phase: seed, min: 2 }) },
    { key: `${node.id}-lat`, title: "Latency", unit: "ms", color: "var(--c-detect)", dec: 0, domain: [0, Math.round(latBase * 2.6)], data: gen(latBase, latBase * 0.5, { phase: seed + 3, spike: 0.6, min: 5 }) },
  ];

  const KPIS = [
    { label: "uptime", value: meta?.uptime ?? "—" },
    { label: "req/s", value: String(meta?.reqPerSec ?? "—") },
    { label: "p50 latency", value: `${meta?.p50 ?? "—"} ms` },
    { label: "error rate", value: meta?.errorRate ?? "—" },
    { label: "bandwidth", value: bw ? `↓${bw.down} ↑${bw.up}` : "—" },
    { label: "dirty queue", value: String(node.dirtyQueue ?? 0), warn: (node.dirtyQueue ?? 0) > 0 },
  ];

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <button aria-label="Close" onClick={onClose} className="fixed inset-0 cursor-default" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }} />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${node.id} detail`}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.28, ease: EASE }}
        className="relative w-full max-w-[940px] overflow-hidden rounded-[var(--radius)]"
        style={{ background: "var(--panel)", border: "1px solid var(--panel-hairline)", boxShadow: "var(--shadow-panel)" }}
      >
        {/* sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4" style={{ background: "var(--panel)", borderBottom: "1px solid var(--panel-hairline)" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: "color-mix(in oklch, var(--backend) 16%, transparent)" }}>
              <Server size={18} strokeWidth={1.85} style={{ color: "var(--backend)" }} />
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="tnum text-[15px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>{node.id}</span>
                {isLeader ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide" style={{ background: "color-mix(in oklch, var(--backend) 20%, transparent)", color: "var(--backend)" }}><Crown size={9} /> leader</span>
                ) : (
                  <span className="rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide" style={{ border: "1px solid var(--panel-hairline)", color: "var(--panel-ink-3)" }}>follower</span>
                )}
              </div>
              <div className="tnum mt-0.5 text-[11px]" style={{ color: "var(--panel-ink-3)" }}>backend node · up {meta?.uptime ?? "—"} · heartbeat {(node.ageMs / 1000).toFixed(1)}s ago</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5" style={{ background: `color-mix(in oklch, ${sc} 14%, transparent)` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc }} />
              <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: sc }}>{node.status}</span>
            </span>
            <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-80" style={{ color: "var(--panel-ink-3)" }}><X size={15} /></button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2 px-5 pt-4 sm:grid-cols-6">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-xl px-3 py-2.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{k.label}</div>
              <div className="tnum mt-0.5 text-[14px] font-semibold" style={{ color: k.warn ? "var(--processing)" : "var(--panel-ink)" }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* charts */}
        <div className="px-5 pt-4">
          <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}><Cpu size={12} /> live metrics</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {charts.map((m) => <TimeChart key={m.key} m={m} height={100} />)}
          </div>
        </div>

        {/* hardware + storage */}
        <div className="grid grid-cols-1 gap-3 px-5 pt-4 lg:grid-cols-2">
          <div className="rounded-xl p-3.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>hardware</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {NODE_HARDWARE.map((h) => (
                <div key={h.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{h.label}</span>
                  <span className="tnum text-[11px] font-medium" style={{ color: "var(--panel-ink)" }}>{h.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}><HardDrive size={12} /> storage</div>
            {cache && (
              <div className="space-y-1 text-[11px]" style={{ color: "var(--panel-ink-2)" }}>
                <div className="flex justify-between gap-2"><span>L1 cache</span><span className="tnum text-right" style={{ color: "var(--panel-ink)" }}>{cache.l1.entries.toLocaleString()} · {fmtBytes(cache.l1.bytes)} · {formatAge(CLUSTER_NOW - cache.l1.updatedMs)}</span></div>
                <div className="flex justify-between gap-2"><span>L3 disk</span><span className="tnum text-right" style={{ color: "var(--panel-ink)" }}>{cache.l3.files.toLocaleString()} files · {fmtBytes(cache.l3.bytes)} · {formatAge(CLUSTER_NOW - cache.l3.updatedMs)}</span></div>
              </div>
            )}
            <div className="mt-3">
              <div className="flex justify-between text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}><span>disk used</span><span className="tnum">{meta?.diskUsedPct ?? 0}% of 3.84 TB</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: "var(--panel)" }}>
                <div className="h-full rounded-full" style={{ width: `${meta?.diskUsedPct ?? 0}%`, background: "var(--c-render)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* node log */}
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}><ScrollText size={12} /> node log</div>
          <div className="overflow-hidden rounded-xl" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
            {nodeLog.map((l, i) => (
              <div key={i} className="flex items-baseline gap-2.5 px-3 py-1.5" style={{ borderTop: i ? "1px solid var(--panel-hairline)" : "none" }}>
                <span className="tnum w-[50px] shrink-0 text-[10px]" style={{ color: "var(--panel-ink-3)" }}>{l.t}</span>
                <span className="w-[40px] shrink-0 rounded px-1 text-center text-[9px] font-bold uppercase" style={{ background: `color-mix(in oklch, ${LEVEL_COLOR[l.level]} 16%, transparent)`, color: LEVEL_COLOR[l.level] }}>{l.level}</span>
                <span className="w-[62px] shrink-0 truncate text-[10.5px]" style={{ color: "var(--panel-ink-2)" }}>{l.src}</span>
                <span className="tnum flex-1 text-[11px] leading-snug" style={{ color: "var(--panel-ink)" }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
