"use client";

// MIT Staff Console — the dashboard shell (#304). Speck-flavored: premium monotone base (warm charcoal
// chrome, Arcana oversized tabular numbers) with Speck/PremiumBuss color used FREELY on data viz — a coral
// signature across the bar chart, the donut, the active nav, deltas. Status signal (shape+label+color)
// reads on any surface. Env-synced: every panel reads `useLiveSnapshot()` (MOCK_MIT when
// NEXT_PUBLIC_MOCKUP_MODE=true, else the live MIT stream — one render path); panels with no live source
// gate to No Data so the mock→real switch can't strand one. Rendered at `/` and `/preview`. DESIGN.md is the spec.

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Boxes, Cpu, LayoutGrid, ListTree, Search, Server, Settings, Sun, Moon, Wifi, WifiOff, X, Zap, type LucideIcon } from "lucide-react";
import { buildNodeDebug, type NodeFull } from "@/lib/node-debug";
import { MIT_TABS } from "@/lib/service-tabs";
import { useDevAuth } from "@/components/auth-gate";
import { useLiveSnapshot } from "@/components/use-live-snapshot";
import type { MitLive } from "@/lib/live-map";
import CountUp from "@/components/count-up";

// Palette now lives in globals.css (warm Speck tokens, dark default + .light). The toggle below
// flips the .light class on the root — no local palette override.

// Nav = 4 (DESIGN.md §4). Logs/Console are not nav items — they live in the per-node popup.
const NAV = [
  { icon: LayoutGrid, label: "Overview" },
  { icon: Activity, label: "Frontend" },
  { icon: Server, label: "Backend" },
  { icon: Cpu, label: "MIT" },
];

const THROUGHPUT = [
  { t: "11:00", v: 620 }, { t: "12:00", v: 880 }, { t: "13:00", v: 1100 },
  { t: "14:00", v: 1284 }, { t: "15:00", v: 940 }, { t: "16:00", v: 1180 },
];
const ACTIVE = 3;

// VRAM segment colours (coral signature → warm ramp → muted available); shared by the donut + legend.
const VRAM_COLORS = ["var(--coral)", "#f6906f", "#f6b38f", "#6b5a52"];


// Node status grid (PremiumBuss lime) — clusters of nodes; each tile shows online/down + current
// usage. `v` is kept as a recent-usage series (last value = current); history → the node popup.
const CLUSTERS = [
  {
    name: "C1 · Frontend", nodes: [
      { id: "fe-0", on: true, v: [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.68, 0.62, 0.58, 0.5, 0.45] },
      { id: "fe-1", on: true, v: [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.62, 0.6, 0.55, 0.5, 0.45, 0.4] },
      { id: "edge", on: true, v: [0.5, 0.52, 0.55, 0.6, 0.65, 0.7, 0.72, 0.7, 0.66, 0.6, 0.55, 0.5] },
    ],
  },
  {
    name: "C2 · Backend", nodes: [
      { id: "api-0", on: true, v: [0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.78, 0.7, 0.6, 0.5, 0.42] },
      { id: "api-1", on: false, v: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: "redis", on: true, v: [0.45, 0.48, 0.5, 0.55, 0.6, 0.62, 0.65, 0.63, 0.6, 0.55, 0.5, 0.46] },
    ],
  },
  {
    name: "C3 · GPU + workers", nodes: [
      { id: "gpu0", on: true, v: [0.6, 0.65, 0.7, 0.62, 0.68, 0.72, 0.66, 0.64, 0.7, 0.68, 0.66, 0.7] },
      { id: "w-5013", on: true, v: [0.4, 0.5, 0.55, 0.6, 0.7, 0.85, 0.95, 0.9, 0.88, 0.92, 0.96, 0.94] },
      { id: "w-5014", on: true, v: [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.5, 0.48, 0.52, 0.5, 0.48, 0.5] },
      { id: "w-5015", on: true, v: [0.2, 0.25, 0.3, 0.28, 0.32, 0.3, 0.35, 0.3, 0.28, 0.32, 0.3, 0.28] },
      { id: "w-5016", on: false, v: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
];

const STATUS: Record<string, string> = { ok: "var(--up)", error: "var(--coral)", idle: "var(--idle)", info: "var(--accent-amber)" };


// Arcana vitals gauges — GPU / VRAM / CPU / RAM (ring or arc), mono. % is static (the arc/ring
// sweeps on mount; CountUp drives the big KPI numbers, not the gauge dials, to avoid desync).
const VITALS = [
  { kind: "ring", label: "GPU util", pct: 64, sub: "5.8 / 12.3 GB · 67°C" },
  { kind: "arc", label: "VRAM used", pct: 47, sub: "5.8 / 12.3 GB" },
  { kind: "ring", label: "CPU", pct: 42, sub: "16 cores · 61% disk" },
  { kind: "arc", label: "RAM", pct: 31, sub: "9.8 / 32 GB" },
] as const;

function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`rounded-[14px] ${className}`} style={{ background: "var(--panel)", border: "1px solid var(--hairline)", ...style }}>{children}</section>;
}
function Dot({ s }: { s: string }) { return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS[s] }} />; }

/* Speck bar: coral hatch fill; the active bar is solid coral. Its value label is an HTML overlay
   (rendered over the chart card, outside the SVG) so it is never clipped by recharts' plot clipPath. */
function barShape(p: { x?: number; y?: number; width?: number; height?: number; index?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0 } = p;
  const on = index === ACTIVE;
  return <rect x={x} y={y} width={width} height={height} rx={5} fill={on ? "var(--coral)" : "url(#hatch)"} stroke="var(--coral)" strokeOpacity={on ? 0 : 0.3} />;
}

// ease-out-quint — sweep settles fast then eases; reduced-motion is handled by globals (kills transition).
const SWEEP = "stroke-dashoffset 0.95s cubic-bezier(0.22, 1, 0.36, 1)";

/* Arcana ring gauge — mono stroke on a faint track; inverted flips ink↔bg for the dark hero card.
   Sweeps 0 → pct on mount via an animated strokeDashoffset. */
function Ring({ pct, size = 76, sw = 7, inverted = false }: { pct: number; size?: number; sw?: number; inverted?: boolean }) {
  const r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setP(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} stroke={inverted ? "color-mix(in oklch, var(--bg) 24%, transparent)" : "var(--hairline)"} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} strokeLinecap="round" stroke={inverted ? "var(--bg)" : "var(--ink)"} strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: SWEEP }} />
    </svg>
  );
}

/* Arcana arc gauge — 180° speedometer, mono ink over a faint track. Reveals 0 → pct via dashoffset on
   a pathLength-normalized full semicircle (so it sweeps from the left, not redraws). */
function Arc({ pct, size = 116 }: { pct: number; size?: number }) {
  const r = size / 2 - 8, cx = size / 2, cy = size / 2;
  const full = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const [p, setP] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setP(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return (
    <svg width={size} height={size / 2 + 6} viewBox={`0 0 ${size} ${size / 2 + 6}`}>
      <path d={full} fill="none" stroke="var(--hairline)" strokeWidth={8} strokeLinecap="round" />
      <path d={full} fill="none" stroke="var(--ink)" strokeWidth={8} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - p} style={{ transition: SWEEP }} />
    </svg>
  );
}

// Hover tooltips — styled to the warm/mono theme (not recharts' default white box).
const tipBox: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--hairline)", borderRadius: 9, padding: "7px 11px", boxShadow: "0 8px 22px -8px rgba(0,0,0,0.55)" };
function BarTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tipBox}>
      <div className="text-[10px] tnum" style={{ color: "var(--ink-3)" }}>{label}</div>
      <div className="text-[12.5px] font-semibold tnum" style={{ color: "var(--ink)" }}>{payload[0].value.toLocaleString()} <span className="font-normal" style={{ color: "var(--ink-3)" }}>pages</span></div>
    </div>
  );
}
function PieTip({ active, payload, total = 12.3 }: { active?: boolean; payload?: { name?: string; value?: number }[]; total?: number }) {
  if (!active || !payload?.length) return null;
  const { name = "", value = 0 } = payload[0];
  const pct = Math.round((value / total) * 100);
  return (
    <div style={tipBox}>
      <div className="text-[11px] font-medium" style={{ color: "var(--ink)" }}>{name}</div>
      <div className="mt-0.5 text-[11px] tnum" style={{ color: "var(--ink-2)" }}>{value} GB · {pct}%</div>
    </div>
  );
}

/* VRAM donut — own component so mouse-tracking re-renders stay local. Tooltip follows the cursor
   (recharts pins Pie tooltips at the centroid by default) and may escape the small 120px box. */
/* Node usage swatch on the lime grid: dark-ink fill, alpha = current usage; offline = empty red ring. */
function nodeDot(on: boolean, v: number): React.CSSProperties {
  if (!on) return { background: "transparent", border: "1.5px solid rgba(127,29,29,0.65)" };
  return { background: `rgba(11,30,2,${(0.12 + 0.82 * Math.max(0, Math.min(1, v))).toFixed(2)})`, border: "1.5px solid rgba(11,30,2,0.30)" };
}

function VramDonut({ models, totalGb, usedGb }: { models: { name: string; v: number }[]; totalGb: number; usedGb: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | undefined>();
  const data = [...models, { name: "available", v: Math.round((totalGb - usedGb) * 10) / 10 }];
  const colors = [...VRAM_COLORS, "var(--surface-2)"];
  return (
    <div
      className="relative h-[120px] w-[120px] shrink-0"
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: e.clientX - r.left + 12, y: e.clientY - r.top + 8 }); }}
      onMouseLeave={() => setPos(undefined)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip position={pos} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ outline: "none" }} content={<PieTip total={totalGb} />} />
          <Pie data={data} dataKey="v" innerRadius={38} outerRadius={56} paddingAngle={2} stroke="none" isAnimationActive animationBegin={200} animationDuration={850} animationEasing="ease-out">
            {data.map((_, i) => <Cell key={i} fill={colors[i]} stroke={i === data.length - 1 ? "var(--hairline)" : "none"} strokeWidth={1} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <CountUp to={usedGb} duration={1.2} className="text-[19px] font-semibold leading-none tnum" /><span className="text-[10px]" style={{ color: "var(--ink-3)" }}>GB used</span>
      </div>
    </div>
  );
}

// Per-node mock for the debug popup. GPU workers report the full set; FE/BE nodes have no GPU (those
// fields come through null → No Data); offline nodes report only errors + their last logs. Mirrors
// what MIT will emit once per-node telemetry is extended (#279) — today most fields would be No Data.
function mockNode(id: string, online: boolean): NodeFull {
  const gpu = id === "gpu0" || id.startsWith("w-");
  if (!online)
    return { id, online: false, spec: gpu ? "RTX 4070 Super · Ryzen 9 7900" : "edge node",
      errors: ["worker unreachable — no heartbeat for 4m", "last seen 16:06:12"],
      logs: ["[16:06:12] heartbeat lost", "[16:06:40] marked offline", "[16:06:41] jobs requeued"],
      console: [`${id}@host:~$ status`, "→ unreachable — no heartbeat (offline)", `${id}@host:~$ `] };
  return {
    id, online: true,
    spec: gpu ? "RTX 4070 Super 12GB · Ryzen 9 7900 · 32GB" : "Next.js edge · 4 vCPU · 8GB",
    gpuUsage: gpu ? 64 : null, cpuUsage: 42,
    gpuClockMhz: gpu ? 2610 : null, cpuClockMhz: 4100,
    vramUsedGb: gpu ? 5.8 : null, vramTotalGb: gpu ? 12.3 : null,
    ramUsedGb: 9.8, ramTotalGb: 32,
    gpuTempC: gpu ? 67 : null, cpuTempC: 55, fanPct: gpu ? 55 : null,
    powerW: gpu ? 182 : null, bandwidthMbps: 940,
    errors: id === "gpu0" ? ["render-fonts VRAM not freed — leak 920MB"] : [],
    logs: [`[16:10:14] ${id} · translate timeout (9arm)`, `[16:08:42] ${id} · ocr 8 lines + 1 SFX`, `[16:08:41] ${id} · detection 8 regions 0.84s`],
    console: [`${id}@host:~$ status`, `→ ${gpu ? "gpu 64% · vram 5.8/12.3 GB · 67°C" : "cpu 42% · ram 9.8/32 GB"} · up 4h12m`, `${id}@host:~$ probe`, `→ ${id === "gpu0" ? "render-fonts leak 920MB ⚠" : "ok"}`, `${id}@host:~$ `],
  };
}

/* Per-node debug popup (opened from the heatmap). Sections from buildNodeDebug; a field MIT doesn't
   emit renders "No Data". Modal pattern: backdrop click + Esc close, focus-trap left for harden. */
function NodePopup({ node, onClose }: { node: { id: string; online: boolean } | null; onClose: () => void }) {
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);
  if (!node) return null;
  const n = mockNode(node.id, node.online);
  const sections = buildNodeDebug(n);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-[18px] p-7" style={{ maxWidth: 700, background: "var(--panel)", border: "1px solid var(--hairline-strong)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between border-b pb-4" style={{ borderColor: "var(--hairline)" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: "var(--surface-2)" }}><Server size={18} style={{ color: "var(--ink-2)" }} /></span>
            <div>
              <div className="flex items-center gap-2"><span className="text-[16px] font-semibold tnum">{n.id}</span><span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: n.online ? "color-mix(in oklch, var(--up) 14%, transparent)" : "var(--coral-soft)", color: n.online ? "var(--up)" : "var(--coral)" }}><Dot s={n.online ? "ok" : "error"} />{n.online ? "online" : "offline"}</span></div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>{n.spec ?? "—"}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: "var(--surface-2)" }}><X size={15} style={{ color: "var(--ink-2)" }} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sections.map((sec) => (
            <div key={sec.title} className="rounded-[12px] p-3.5" style={{ background: "rgba(0,0,0,0.20)", border: "1px solid var(--hairline-strong)" }}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>{sec.title}</div>
              <div className="flex flex-col gap-1.5">
                {sec.metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between text-[11.5px]">
                    <span style={{ color: "var(--ink-2)" }}>{m.label}</span>
                    {m.value == null
                      ? <span className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>No Data</span>
                      : <span className="tnum font-medium">{m.value}{m.unit ? <span style={{ color: "var(--ink-3)" }}> {m.unit}</span> : null}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Errors — full width */}
        <div className="mt-3 rounded-[12px] p-3.5" style={{ background: "rgba(0,0,0,0.20)", border: "1px solid var(--hairline-strong)" }}>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>Errors</div>
          {n.errors && n.errors.length ? n.errors.map((e, i) => <div key={i} className="text-[11px] leading-snug" style={{ color: "var(--coral)" }}>{e}</div>) : <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>none</div>}
        </div>
        {/* per-node Logs + Console (DESIGN.md §4 — Logs/Console live in the node popup) */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[12px] p-3.5" style={{ background: "rgba(0,0,0,0.20)", border: "1px solid var(--hairline-strong)" }}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>Logs · {n.id}</div>
            <div className="flex flex-col gap-0.5 font-mono">
              {n.logs && n.logs.length ? n.logs.map((l, i) => <div key={i} className="truncate text-[10.5px]" style={{ color: l.includes("timeout") || l.includes("lost") ? "var(--coral)" : "var(--ink-2)" }}>{l}</div>) : <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>No Data</div>}
            </div>
          </div>
          <div className="overflow-hidden rounded-[12px]" style={{ background: "rgba(0,0,0,0.34)", border: "1px solid var(--hairline-strong)" }}>
            <div className="border-b px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: "var(--hairline)", color: "var(--ink-3)" }}>Console · {n.id}</div>
            <div className="flex flex-col gap-0.5 p-3.5 font-mono text-[10.5px] leading-relaxed">
              {n.console && n.console.length ? n.console.map((l, i) => (
                l.startsWith("→") ? <div key={i} className="truncate" style={{ color: l.includes("⚠") ? "var(--coral)" : "var(--ink-2)" }}>{l}</div>
                : <div key={i} className="truncate"><span style={{ color: "var(--success)" }}>{l.replace(/\s*$/, "")}</span>{l.endsWith("$ ") && <span className="animate-pulse" style={{ color: "var(--coral)" }}>▋</span>}</div>
              )) : <div style={{ color: "var(--ink-3)" }}>No Data</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A per-view header: service glyph + name + tech line, with an optional right slot (status chip / filters).
function ViewShell({ Icon, name, tech, color, right, children }: { Icon: LucideIcon; name: string; tech: string; color: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: `color-mix(in oklch, ${color} 18%, transparent)` }}><Icon size={19} style={{ color }} /></span>
          <div><h1 className="text-[22px] font-semibold tracking-tight">{name}</h1><p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>{tech}</p></div>
        </div>
        {right}
      </div>
      {children}
    </>
  );
}

// Frontend / Backend — no live source yet (#283/#282); one honest empty state, not mock panels.
function NoDataView({ Icon, name, tech, color, msg }: { Icon: LucideIcon; name: string; tech: string; color: string; msg: string }) {
  return (
    <ViewShell Icon={Icon} name={name} tech={tech} color={color}>
      <Panel className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--surface-2)" }}><WifiOff size={20} style={{ color: "var(--ink-3)" }} /></span>
        <div className="text-[14px] font-semibold">No telemetry</div>
        <p className="max-w-[400px] text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{msg}</p>
      </Panel>
    </ViewShell>
  );
}

// Live-derived data bundle the MIT depth tabs consume (same source as the overview — one render path).
type Stage = { id: string; label: string; t: string; s: string };
type MitData = {
  m: MitLive | null;
  mock: boolean;
  stages: Stage[];
  vitals: { kind: "ring" | "arc"; label: string; pct: number; sub: string }[] | null;
  vramModels: { name: string; v: number; leaked: boolean }[];
  vramTotal: number;
  vramUsed: number;
};

// ── MIT depth page — tabs (Pipeline/Telemetry/Queue/Workers), DESIGN.md §4 (Logs/Console → node popup) ──
function MitPipeline({ stages, gateway }: { stages: Stage[]; gateway: MitLive["gateway"] | undefined }) {
  const down = gateway?.status === "down";
  return (
    <div className="flex flex-col gap-3">
      {gateway ? (
        <Panel className="p-5" style={down ? { background: "var(--coral-soft)", border: "1px solid color-mix(in oklch, var(--coral) 32%, transparent)" } : undefined}>
          <div className="mb-3 flex items-center gap-2">
            {down ? <AlertTriangle size={14} style={{ color: "var(--coral)" }} /> : <Activity size={14} style={{ color: "var(--ink-2)" }} />}
            <span className="text-[12.5px] font-semibold" style={{ color: down ? "var(--coral)" : "var(--ink)" }}>Gateway diagnosis</span>
            <span className="ml-auto text-[11px] font-semibold" style={{ color: down ? "var(--coral)" : "var(--success)" }}>{down ? "translate stalled" : "healthy"}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[12px] sm:grid-cols-4">
            {([["status", gateway.status], ["detail", gateway.detail ?? "—"], ["control", gateway.controlMs != null ? `${gateway.controlMs}ms` : "—"], ["latency", gateway.latencyMs != null ? `${gateway.latencyMs}ms` : "—"]] as [string, string][]).map(([k, v]) => (
              <div key={k}><div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>{k}</div><div className="mt-0.5 truncate font-medium tnum" title={v}>{v}</div></div>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel className="py-10 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No gateway data</Panel>
      )}
      <Panel className="p-5">
        <div className="mb-4 flex items-center gap-2"><Activity size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">Stage timing</span></div>
        {stages.length ? (
          <div className="flex flex-col gap-2.5">
            {stages.map((st) => {
              const sec = parseFloat(st.t);
              const pct = st.s === "error" ? 100 : Math.min(100, ((isNaN(sec) ? 0 : sec) / 95) * 100);
              return (
                <div key={st.id} className="flex items-center gap-3">
                  <span className="flex w-20 shrink-0 items-center gap-1.5 text-[11.5px]" style={{ color: st.s === "idle" ? "var(--ink-3)" : "var(--ink)" }}><Dot s={st.s} />{st.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: st.s === "error" ? "var(--coral)" : "var(--ink-2)", transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)" }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[11.5px] tnum" style={{ color: st.s === "error" ? "var(--coral)" : "var(--ink-2)" }}>{st.t}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No pipeline data</div>
        )}
      </Panel>
    </div>
  );
}

function MitTelemetry({ vitals, vramModels, vramTotal, vramUsed, hasGpu }: { vitals: MitData["vitals"]; vramModels: MitData["vramModels"]; vramTotal: number; vramUsed: number; hasGpu: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {vitals ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {vitals.map((v) => (
            <Panel key={v.label} className="flex flex-col items-center justify-center p-4">
              {v.kind === "ring" ? (
                <div className="relative flex items-center justify-center"><Ring pct={v.pct} size={66} sw={6} /><span className="absolute text-[12px] font-semibold tnum">{v.pct}%</span></div>
              ) : (
                <div className="relative pb-1"><Arc pct={v.pct} size={92} /><span className="absolute inset-x-0 bottom-0 text-center text-[12px] font-semibold tnum">{v.pct}%</span></div>
              )}
              <div className="mt-2 text-[11.5px] font-medium" style={{ color: "var(--ink-2)" }}>{v.label}</div>
              <div className="mt-0.5 text-center text-[10px] tnum" style={{ color: "var(--ink-3)" }}>{v.sub}</div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel className="flex flex-col items-center justify-center gap-1.5 p-8 text-center"><WifiOff size={18} style={{ color: "var(--ink-3)" }} /><div className="text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>No telemetry</div></Panel>
      )}
      <Panel className="p-5">
        <div className="mb-3 flex items-center gap-2"><Cpu size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">VRAM by model</span><span className="ml-auto text-[11px] tnum" style={{ color: "var(--ink-3)" }}>{hasGpu ? `${vramUsed} / ${vramTotal} GB` : "—"}</span></div>
        {hasGpu ? (
          <div className="flex items-center gap-3">
            <VramDonut models={vramModels} totalGb={vramTotal} usedGb={vramUsed} />
            <div className="flex flex-1 flex-col gap-1.5">
              {vramModels.map((vm, i) => (<div key={vm.name} className="flex items-center gap-2 text-[11px]"><span className="h-2 w-2 rounded-[3px]" style={{ background: VRAM_COLORS[i % VRAM_COLORS.length] }} /><span className="flex-1 truncate" style={{ color: vm.leaked ? "var(--coral)" : "var(--ink-2)" }}>{vm.name}{vm.leaked && " · leak"}</span><span className="tnum" style={{ color: "var(--ink-3)" }}>{vm.v}</span></div>))}
              <div className="flex items-center gap-2 text-[11px]"><span className="h-2 w-2 rounded-[3px]" style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }} /><span className="flex-1 truncate" style={{ color: "var(--ink-3)" }}>available</span><span className="tnum" style={{ color: "var(--ink-3)" }}>{Math.round((vramTotal - vramUsed) * 10) / 10}</span></div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No GPU telemetry</div>
        )}
      </Panel>
    </div>
  );
}

function MitQueue({ jobs }: { jobs: NonNullable<MitLive["queueJobs"]> }) {
  const fmtWait = (ms: number) => (ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${ms}ms`);
  const rows = jobs.map((j) => ({
    id: j.id,
    manga: j.taskId,
    stage: j.taskType,
    s: j.state === "running" && (j.waitingMs ?? 0) >= 30000 ? "error" : j.state === "running" ? "info" : "idle",
    wait: j.state === "queued" ? "—" : fmtWait(j.waitingMs ?? 0),
  }));
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2"><ListTree size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">Translate queue</span><span className="ml-auto text-[11px] tnum" style={{ color: "var(--ink-3)" }}>{rows.length} jobs</span></div>
      {rows.length ? (
        <div className="flex flex-col">
          <div className="flex items-center gap-3 border-b pb-2 text-[10.5px] font-medium uppercase tracking-wide" style={{ borderColor: "var(--hairline)", color: "var(--ink-3)" }}>
            <span className="w-16">job</span><span className="flex-1">task</span><span className="w-24">stage</span><span className="w-12 text-right">wait</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-t py-2.5 text-[12px] first:border-t-0" style={{ borderColor: "var(--hairline)" }}>
              <span className="w-16 truncate tnum" style={{ color: "var(--ink-3)" }}>{r.id}</span>
              <span className="flex-1 truncate font-medium">{r.manga}</span>
              <span className="flex w-24 items-center gap-1.5" style={{ color: r.s === "error" ? "var(--coral)" : "var(--ink-2)" }}><Dot s={r.s} />{r.stage}</span>
              <span className="w-12 text-right tnum" style={{ color: r.s === "error" ? "var(--coral)" : "var(--ink-3)" }}>{r.wait}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No jobs in queue</div>
      )}
    </Panel>
  );
}

function MitWorkers({ workers, onOpenNode }: { workers: NonNullable<MitLive["workersDetail"]>; onOpenNode: (n: { id: string; online: boolean }) => void }) {
  const fmtUp = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);
  if (!workers.length) return <Panel className="py-10 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No workers reporting</Panel>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {workers.map((w) => {
        const id = `w-${w.port}`;
        return (
          <button key={`${w.ip}:${w.port}`} onClick={() => onOpenNode({ id, online: true })} className="block text-left">
            <Panel className="p-4 transition-colors hover:brightness-110">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-semibold tnum"><Dot s="info" />{id}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--surface-2)", color: w.busy ? "var(--accent-amber)" : "var(--ink-2)" }}>{w.busy ? "busy" : "idle"}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px]">
                {([["ip", `${w.ip}:${w.port}`], ["pid", String(w.pid)], ["job", w.busy ? "running" : "—"], ["uptime", fmtUp(w.uptimeS ?? 0)]] as [string, string][]).map(([k, v]) => (
                  <div key={k}><span style={{ color: "var(--ink-3)" }}>{k} </span><span className="tnum" style={{ color: "var(--ink-2)" }}>{v}</span></div>
                ))}
              </div>
            </Panel>
          </button>
        );
      })}
    </div>
  );
}

function MitView({ data, onOpenNode }: { data: MitData; onOpenNode: (n: { id: string; online: boolean }) => void }) {
  const [tab, setTab] = useState(MIT_TABS[0].id);
  const { m } = data;
  const right = m ? (
    <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium" style={m.status === "ok" ? { background: "color-mix(in oklch, var(--success) 12%, transparent)", border: "1px solid color-mix(in oklch, var(--success) 26%, transparent)", color: "var(--success)" } : { background: "var(--coral-soft)", border: "1px solid color-mix(in oklch, var(--coral) 30%, transparent)", color: "var(--coral)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.status === "ok" ? "var(--success)" : "var(--coral)" }} />{m.status === "ok" ? "healthy" : `${m.status} · translate`}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}><WifiOff size={12} /> offline</span>
  );
  return (
    <ViewShell Icon={Cpu} name="MIT" tech="Python ML · image translation" color="var(--mit)" right={right}>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--hairline)" }}>
        {MIT_TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="relative shrink-0 px-3.5 py-2 text-[12.5px] font-medium transition-colors" style={{ color: tab === tb.id ? "var(--ink)" : "var(--ink-3)" }}>
            {tb.label}
            {tab === tb.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full" style={{ background: "var(--coral)" }} />}
          </button>
        ))}
      </div>
      {tab === "pipeline" && <MitPipeline stages={data.stages} gateway={m?.gateway} />}
      {tab === "telemetry" && <MitTelemetry vitals={data.vitals} vramModels={data.vramModels} vramTotal={data.vramTotal} vramUsed={data.vramUsed} hasGpu={!!m?.gpu} />}
      {tab === "queue" && <MitQueue jobs={m?.queueJobs ?? []} />}
      {tab === "workers" && <MitWorkers workers={m?.workersDetail ?? []} onOpenNode={onOpenNode} />}
    </ViewShell>
  );
}

// ── Cross-service infra topics (ported from :4100 lib/services; no live MIT source → mock-only / NoData) ──
const INFRA_USERS = { active: 342, total: 12847 };
const INFRA_BW = [
  { name: "Frontend", color: "var(--frontend)", down: 86, up: 14 },
  { name: "Backend", color: "var(--backend)", down: 42, up: 18 },
  { name: "MIT", color: "var(--mit)", down: 14, up: 6 },
];
const INFRA_STREAMS = [
  { service: "Frontend", state: "connected", lastS: 1, revalS: 8 },
  { service: "Backend", state: "connected", lastS: 1, revalS: 54 },
  { service: "MIT", state: "reconnecting", lastS: 30, revalS: 30 },
];

// Traffic — users online + bandwidth per service (Overview rollup; per-node bandwidth → node popup).
function TrafficPanel() {
  const maxBw = Math.max(...INFRA_BW.map((b) => b.down + b.up));
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2"><Activity size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">Traffic</span><span className="ml-auto text-[11px] tnum" style={{ color: "var(--ink-3)" }}>{INFRA_USERS.active} online · {INFRA_USERS.total.toLocaleString()} total</span></div>
      <div className="flex flex-col gap-2.5">
        {INFRA_BW.map((b) => (
          <div key={b.name} className="flex items-center gap-3 text-[11.5px]">
            <span className="w-16 shrink-0" style={{ color: "var(--ink-2)" }}>{b.name}</span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${((b.down + b.up) / maxBw) * 100}%`, background: b.color, transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)" }} />
            </div>
            <span className="w-24 shrink-0 text-right tnum" style={{ color: "var(--ink-3)" }}>↓{b.down} ↑{b.up} MB/s</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// SSE stream health — per-service connection state + last-event / revalidate age.
function StreamsPanel() {
  const dotFor = (s: string) => (s === "connected" ? "ok" : s === "reconnecting" ? "info" : "error");
  const healthy = INFRA_STREAMS.filter((s) => s.state === "connected").length;
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2"><Wifi size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">SSE streams</span><span className="ml-auto text-[11px] font-semibold" style={{ color: healthy === INFRA_STREAMS.length ? "var(--success)" : "var(--accent-amber)" }}>{healthy}/{INFRA_STREAMS.length} healthy</span></div>
      <div className="flex flex-col">
        {INFRA_STREAMS.map((s) => (
          <div key={s.service} className="flex items-center gap-3 border-t py-2 text-[11.5px] first:border-0" style={{ borderColor: "var(--hairline)" }}>
            <Dot s={dotFor(s.state)} />
            <span className="w-20 shrink-0 font-medium">{s.service}</span>
            <span className="flex-1" style={{ color: s.state === "connected" ? "var(--ink-2)" : "var(--accent-amber)" }}>{s.state}</span>
            <span className="tnum text-[10.5px]" style={{ color: "var(--ink-3)" }}>last {s.lastS}s · reval {s.revalS}s</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const [view, setView] = useState("Overview");
  const [openNode, setOpenNode] = useState<{ id: string; online: boolean } | null>(null);
  // Wall-clock timestamps are client-only (server/client TZ + mock Date.now() differ → hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Env-synced data: useLiveSnapshot serves MOCK_MIT when NEXT_PUBLIC_MOCKUP_MODE=true, else the real
  // MIT stream — one shape (MitLive), one render path. Flipping the flag is the mock→real wiring check.
  const { token } = useDevAuth();
  const live = useLiveSnapshot(token);
  const m = live.mit;
  const mock = live.mock ?? false;

  // Panels with a MitLive field read from `m` (works for mock AND live). Panels with no live source show
  // their design mock only in mock mode, else No Data — that gap surfaces what still needs wiring.
  const ratio = (used?: number, total?: number) => (used != null && total ? Math.round((used / total) * 100) : 0);
  const metrics = [
    { label: "Pages translated", to: 1284, sep: ",", unit: "", delta: "+24.6%", sub: "+312 · 24h", up: true, mockOnly: true },
    { label: "Throughput", to: 18.4, sep: "", unit: "/min", delta: "+9.1%", sub: "+1.6 today", up: true, mockOnly: true },
    { label: "GPU util", to: m?.gpu?.utilPct, sep: "", unit: "%", delta: "−11.4%", sub: m?.gpu ? `${m.gpu.vramUsedGb} / ${m.gpu.vramTotalGb} GB` : "no source", up: false },
    { label: "pages/min source", to: undefined as number | undefined, sep: "", unit: "", delta: "", sub: "No Data · no source", up: false, noData: true },
  ];
  const vitals = m
    ? [
        { kind: "ring" as const, label: "GPU util", pct: m.gpu?.utilPct ?? 0, sub: m.gpu ? `${m.gpu.vramUsedGb} / ${m.gpu.vramTotalGb} GB · ${m.gpu.tempC ?? "—"}°C` : "—" },
        { kind: "arc" as const, label: "VRAM used", pct: m.gpu ? ratio(m.gpu.vramUsedGb, m.gpu.vramTotalGb) : 0, sub: m.gpu ? `${m.gpu.vramUsedGb} / ${m.gpu.vramTotalGb} GB` : "—" },
        { kind: "ring" as const, label: "CPU", pct: m.host.cpuPct, sub: `${m.host.diskUsedPct}% disk` },
        { kind: "arc" as const, label: "RAM", pct: ratio(m.host.ramUsedGb, m.host.ramTotalGb), sub: `${m.host.ramUsedGb} / ${m.host.ramTotalGb} GB` },
      ]
    : null;

  // Pipeline spine from m.stages (liveMs → display): a stage running >30s reads as stalled (error).
  const fmtMs = (ms: number) => (ms >= 10000 ? `${Math.round(ms / 1000)}s` : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`);
  const stages = (m?.stages ?? []).map((st) => {
    const stalled = st.liveMs >= 30000;
    return { id: st.id, label: st.label, t: st.liveMs === 0 ? "idle" : stalled ? `${Math.round(st.liveMs / 1000)}s ⚠` : fmtMs(st.liveMs), s: stalled ? "error" : st.liveMs === 0 ? "idle" : "ok" };
  });

  // Live feed from the event stream (mock or real); incident banner derived from MIT health.
  const feed = live.events.slice(0, 6).map((e) => {
    const ev = e as { kind?: string; detail?: string; at?: number };
    return { s: ev.kind === "error" ? "error" : ev.kind === "info" ? "info" : "ok", text: ev.detail ?? ev.kind ?? "", t: ev.at ? new Date(ev.at).toLocaleTimeString("en-GB") : "" };
  });
  const stalledStage = m?.stages?.find((st) => st.liveMs >= 30000);
  const incident = m && m.status !== "ok" ? { title: stalledStage ? `Pipeline stalled at ${stalledStage.label.toLowerCase()}` : "MIT degraded", detail: m.gateway?.detail ?? "MIT reported a degraded state" } : null;

  // VRAM by model from m.vram (footprint MB → GB); donut adds an `available` segment from the GPU total.
  const GB = (mb: number) => Math.round((mb / 1024) * 10) / 10;
  const vramModels = (m?.vram?.models ?? []).map((vm) => ({ name: vm.model, v: GB(vm.footprintMb), leaked: vm.leaked }));
  const vramTotal = m?.gpu?.vramTotalGb ?? 12.3;
  const vramUsed = m?.gpu?.vramUsedGb ?? 0;

  // Subsystem strip: MIT + its gateway are live-backed (from m); the rest (FE/BE/infra) have no MIT
  // source, so they read mock when mocking, "no source" when live — again surfacing what isn't wired.
  const infra = (label: string, detail: string) => ({ label, detail: mock ? detail : "no source", s: mock ? "ok" : "idle" });
  const subsystems = [
    infra("Frontend", "Next.js · 12ms p50"),
    infra("Backend", "NestJS · 28ms p50"),
    { label: "MIT", detail: m ? (m.status === "ok" ? "healthy" : `${m.status}`) : "offline", s: m ? (m.status === "ok" ? "ok" : "error") : "idle" },
    { label: "9arm gateway", detail: m?.gateway?.detail ?? (m ? "ok" : "—"), s: m?.gateway?.status === "down" ? "error" : m ? "ok" : "idle" },
    infra("Redis · L2", "pub/sub ok · 1ms"),
    infra("Supabase", "REST ok · 42ms"),
    infra("Cloudflare R2", "edge ok · 60ms"),
    infra("Streams", "3 / 3 healthy"),
  ];
  const degradedCount = subsystems.filter((x) => x.s === "error").length;

  // Bundle the live-derived MIT data for the depth tabs (one object → fewer props, same source as overview).
  const mitData = { m, mock, stages, vitals, vramModels, vramTotal, vramUsed };

  return (
    <div className={dark ? "theme-dark" : "light"} style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
      <div className="mx-auto flex max-w-[1280px] gap-0">
        {/* ── sidebar rail (Speck, coral active) ── */}
        <aside className="sticky top-0 hidden h-screen w-[212px] shrink-0 flex-col p-4 lg:flex" style={{ borderRight: "1px solid var(--hairline)" }}>
          <div className="mb-7 flex items-center gap-2.5 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: "var(--coral)" }}><Zap size={17} fill="#1a0d09" color="#1a0d09" /></span>
            <span className="text-[15px] font-semibold tracking-tight">MIT Console</span>
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <button key={n.label} onClick={() => setView(n.label)} className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium transition-colors" style={view === n.label ? { background: "var(--coral-soft)", color: "var(--coral)" } : { color: "var(--ink-2)" }}>
                <n.icon size={16} /> {n.label}
                {n.label === "MIT" && <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tnum" style={{ background: "var(--coral)", color: "#1a0d09" }}>1</span>}
              </button>
            ))}
          </nav>
          <a className="mt-auto flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--ink-2)" }}><Settings size={16} /> Settings</a>
        </aside>

        {/* ── main ── */}
        <main className="min-w-0 flex-1 px-6 py-5">
          {/* top bar */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-[11px] px-3 py-2" style={{ background: "var(--panel)", border: "1px solid var(--hairline)" }}>
              <Search size={14} style={{ color: "var(--ink-3)" }} />
              <span className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>Search stages, workers, jobs…</span>
            </div>
            {mock && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-[11px] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ background: "color-mix(in oklch, var(--accent-amber) 16%, transparent)", border: "1px solid color-mix(in oklch, var(--accent-amber) 34%, transparent)", color: "var(--accent-amber)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-amber)" }} />Mockup data
              </span>
            )}
            <button className="relative flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "var(--panel)", border: "1px solid var(--hairline)" }}>
              <Bell size={15} style={{ color: "var(--ink-2)" }} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: "var(--coral)" }} />
            </button>
            <button onClick={() => setDark((d) => !d)} className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "var(--panel)", border: "1px solid var(--hairline)" }}>
              {dark ? <Sun size={15} style={{ color: "var(--ink-2)" }} /> : <Moon size={15} style={{ color: "var(--ink-2)" }} />}
            </button>
            <div className="flex items-center gap-2.5 rounded-[11px] py-1 pl-1 pr-3" style={{ background: "var(--panel)", border: "1px solid var(--hairline)" }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[11px] font-bold" style={{ background: "var(--surface-2)" }}>X</span>
              <div className="leading-tight"><div className="text-[12px] font-semibold">xeno</div><div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>Staff</div></div>
            </div>
          </div>

          {view === "Overview" && (
          <>
          {/* header */}
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight">Overview</h1>
              <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>MIT pipeline · live telemetry</p>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const c = live.status === "live" ? "var(--success)" : live.status === "connecting" ? "var(--processing)" : "var(--coral)";
                const label = live.status === "live" ? "live · MIT" : live.status === "connecting" ? "connecting…" : "offline";
                return (
                  <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium" style={{ background: `color-mix(in oklch, ${c} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${c} 26%, transparent)`, color: c }}>
                    {live.status === "offline" ? <WifiOff size={12} /> : <Wifi size={12} />} {label}
                  </span>
                );
              })()}
              {incident && (
                <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium" style={{ background: "var(--coral-soft)", border: "1px solid color-mix(in oklch, var(--coral) 30%, transparent)", color: "var(--coral)" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--coral)" }} /> translate degraded
                </span>
              )}
              <span className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold" style={{ background: "var(--coral)", color: "#1a0d09" }}>Export</span>
            </div>
          </div>

          {/* incident banner — only when MIT is degraded/down (derived from live health) */}
          {incident && (
            <div className="mb-3 flex items-center gap-3 rounded-[var(--radius)] px-4 py-3" style={{ background: "var(--coral-soft)", border: "1px solid color-mix(in oklch, var(--coral) 38%, transparent)" }}>
              <AlertTriangle size={16} className="shrink-0" style={{ color: "var(--coral)" }} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--coral)" }}>1 active incident · {incident.title}</div>
                <div className="mt-0.5 truncate text-[11.5px] tnum" style={{ color: "var(--ink-2)" }}>{incident.detail}</div>
              </div>
              <button onClick={() => setView("MIT")} className="shrink-0 cursor-pointer rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ background: "var(--coral)", color: "#1a0d09" }}>View detail →</button>
            </div>
          )}

          {/* metric strip + throughput chart (Speck top row) */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((mm) => {
                const isND = mm.noData || (mm.mockOnly && !mock) || mm.to == null;
                return (
                <Panel key={mm.label} className="flex flex-col justify-between gap-3 p-4">
                  <div className="text-[11.5px] font-medium" style={{ color: "var(--ink-2)" }}>{mm.label}</div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      {isND
                        ? <span className="text-[27px] font-semibold leading-none tnum tracking-tight" style={{ color: "var(--ink-3)" }}>—</span>
                        : <CountUp to={mm.to as number} separator={mm.sep} duration={1.2} className="text-[27px] font-semibold leading-none tnum tracking-tight" />}
                      {!isND && mm.unit && <span className="text-[12px] font-medium" style={{ color: "var(--ink-3)" }}>{mm.unit}</span>}
                    </div>
                    {isND ? (
                      <div className="mt-2.5 text-[11px]" style={{ color: "var(--ink-3)" }}>{mm.noData ? mm.sub : "No live source"}</div>
                    ) : (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className="flex items-center gap-0.5 rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-semibold tnum" style={{ background: mm.up ? "color-mix(in oklch, var(--up) 16%, transparent)" : "color-mix(in oklch, var(--down) 16%, transparent)", color: mm.up ? "var(--up)" : "var(--down)" }}>
                          {mm.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{mm.delta}
                        </span>
                        <span className="text-[10.5px] tnum" style={{ color: "var(--ink-3)" }}>{mm.sub}</span>
                      </div>
                    )}
                  </div>
                </Panel>
                );
              })}
            </div>

            <Panel className="p-5">
              <div className="mb-1 flex items-start justify-between">
                <div>
                  <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>Pages / hour</div>
                  <div className="mt-1 text-[26px] font-semibold leading-none tnum tracking-tight">{mock ? <CountUp to={1284} separator="," duration={1.2} /> : <span style={{ color: "var(--ink-3)" }}>—</span>}</div>
                </div>
                <div className="flex rounded-[9px] p-0.5 text-[11.5px] font-medium" style={{ background: "var(--surface-2)" }}>
                  <span className="rounded-[7px] px-2.5 py-1" style={{ color: "var(--ink-3)" }}>1h</span>
                  <span className="rounded-[7px] px-2.5 py-1 font-semibold" style={{ background: "var(--coral)", color: "#1a0d09" }}>24h</span>
                </div>
              </div>
              {!mock ? (
                <div className="mt-7 flex h-[172px] flex-col items-center justify-center gap-1.5 rounded-[10px] text-center" style={{ background: "var(--surface-2)" }}>
                  <WifiOff size={16} style={{ color: "var(--ink-3)" }} />
                  <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>No live source · pages/hour not emitted by MIT</div>
                </div>
              ) : (
              <div className="relative mt-7 h-[172px]">
                <ResponsiveContainer width="100%" height={172}>
                  <BarChart data={THROUGHPUT} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="34%">
                    <defs>
                      <pattern id="hatch" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
                        <rect width={6} height={6} fill="var(--coral)" opacity={0.16} />
                        <line x1={0} y1={0} x2={0} y2={6} stroke="var(--coral)" strokeWidth={2.5} opacity={0.6} />
                      </pattern>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--hairline)" />
                    <XAxis dataKey="t" height={24} tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: "var(--ink-3)" }} />
                    <YAxis width={28} domain={[0, 1300]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--ink-3)" }} ticks={[0, 650, 1300]} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${v}`)} />
                    <Tooltip cursor={{ fill: "color-mix(in oklch, var(--coral) 9%, transparent)" }} wrapperStyle={{ outline: "none" }} content={<BarTip />} />
                    <Bar dataKey="v" shape={barShape} isAnimationActive animationBegin={150} animationDuration={850} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
                {/* value-pill overlay — HTML, outside the SVG so it can't be clipped; bars keep full height */}
                <div className="pointer-events-none absolute" style={{ left: 28, right: 4, top: 4, bottom: 24 }}>
                  <div className="flex h-full">
                    {THROUGHPUT.map((d, i) => (
                      <div key={i} className="relative flex-1">
                        {i === ACTIVE && (
                          <div className="absolute left-1/2 flex flex-col items-center" style={{ top: `${(1 - d.v / 1300) * 100}%`, transform: "translate(-50%, -100%)" }}>
                            <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold tnum" style={{ background: "var(--coral)", color: "#1a0d09", lineHeight: 1 }}>{d.v.toLocaleString()}</span>
                            <span className="h-1.5 w-0.5" style={{ background: "var(--coral)" }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              )}
            </Panel>
          </div>

          {/* Arcana vitals band — GPU/VRAM/CPU/RAM gauges (mono) + the single inverted hero card */}
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {vitals ? vitals.map((v) => (
              <Panel key={v.label} className="flex flex-col items-center justify-center p-4">
                {v.kind === "ring" ? (
                  <div className="relative flex items-center justify-center">
                    <Ring pct={v.pct} size={66} sw={6} />
                    <span className="absolute text-[12px] font-semibold tnum">{v.pct}%</span>
                  </div>
                ) : (
                  <div className="relative pb-1">
                    <Arc pct={v.pct} size={92} />
                    <span className="absolute inset-x-0 bottom-0 text-center text-[12px] font-semibold tnum">{v.pct}%</span>
                  </div>
                )}
                <div className="mt-2 text-[11.5px] font-medium" style={{ color: "var(--ink-2)" }}>{v.label}</div>
                <div className="mt-0.5 text-center text-[10px] tnum" style={{ color: "var(--ink-3)" }}>{v.sub}</div>
              </Panel>
            )) : (
              <Panel className="col-span-2 flex flex-col items-center justify-center gap-1.5 p-8 text-center sm:col-span-4">
                <WifiOff size={18} style={{ color: "var(--ink-3)" }} />
                <div className="text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>No telemetry</div>
                <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{live.status === "connecting" ? "connecting to MIT…" : "MIT stream offline"}</div>
              </Panel>
            )}
            </div>

            <Panel className="flex flex-col justify-between p-5" style={{ background: "var(--ink)", color: "var(--bg)", border: "none" }}>
              <div className="flex items-start justify-between">
                <span className="text-[11.5px] font-medium" style={{ color: "var(--bg)", opacity: 0.6 }}>Pages translated</span>
                <div className="relative flex items-center justify-center">
                  <Ring pct={94} size={42} sw={5} inverted />
                  <span className="absolute text-[9px] font-semibold tnum" style={{ color: "var(--bg)" }}>94%</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-[30px] font-bold leading-none tnum tracking-tight" style={{ color: "var(--bg)" }}>{mock ? <CountUp to={1284902} separator="," duration={1.5} /> : "—"}</div>
                <div className="mt-1.5 text-[11px] tnum" style={{ color: "var(--bg)", opacity: 0.55 }}>{mock ? "FY2026 · 94% success" : "No live source"}</div>
              </div>
            </Panel>
          </div>

          {/* pipeline spine — MIT hero (coral active / stuck) */}
          <Panel className="mt-3 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Activity size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">Pipeline</span>
              <span className="ml-auto text-[11px]" style={{ color: "var(--ink-3)" }}>total 95.0s · baseline 8.7s · translate stalled</span>
            </div>
            <div className="flex items-stretch gap-1.5">
              {stages.map((st, i) => (
                <div key={st.id} className="flex flex-1 items-center gap-1.5">
                  <div className="flex-1 rounded-[10px] px-3.5 py-3" style={{ background: st.s === "error" ? "var(--coral-soft)" : "var(--surface-2)", border: `1px solid ${st.s === "error" ? "color-mix(in oklch, var(--coral) 45%, transparent)" : "var(--hairline)"}` }}>
                    <div className="flex items-center gap-1.5"><Dot s={st.s} /><span className="text-[11.5px] font-medium" style={{ color: st.s === "idle" ? "var(--ink-3)" : "var(--ink)" }}>{st.label}</span></div>
                    <div className="mt-1.5 text-[13px] tnum" style={{ color: st.s === "error" ? "var(--coral)" : st.s === "idle" ? "var(--ink-3)" : "var(--ink-2)" }}>{st.t}</div>
                  </div>
                  {i < stages.length - 1 && <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>→</span>}
                </div>
              ))}
            </div>
          </Panel>

          {/* subsystem strip — condensed dot+label pills (detail lives on each service page) */}
          <Panel className="mt-3 p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Boxes size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">Subsystems</span>
              {degradedCount > 0 && <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--coral)" }}><Dot s="error" />{degradedCount} degraded</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {subsystems.map((s) => (
                <span key={s.label} className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: s.s === "error" ? "var(--coral-soft)" : "var(--surface-2)", border: `1px solid ${s.s === "error" ? "color-mix(in oklch, var(--coral) 30%, transparent)" : "var(--hairline)"}`, color: s.s === "error" ? "var(--coral)" : "var(--ink-2)" }}>
                  <Dot s={s.s} />{s.label}
                </span>
              ))}
            </div>
          </Panel>

          {/* node status — the multi-node fleet has no live source yet (MIT emits 1 worker); mock-only,
              NoData when live, so the gap is visible (#279 extends per-node telemetry). */}
          {mock ? (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
            <Panel className="p-5">
              <div className="mb-1 flex items-center gap-2"><Server size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">Cluster status</span></div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <CountUp to={9} duration={1.2} className="text-[34px] font-semibold leading-none tnum tracking-tight" />
                <span className="text-[15px] tnum" style={{ color: "var(--ink-3)" }}>/ 11</span>
                <span className="ml-1 text-[12px]" style={{ color: "var(--ink-2)" }}>online</span>
              </div>
              <div className="mt-5 flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center justify-between"><span style={{ color: "var(--ink-2)" }}>C1 · Frontend</span><span className="tnum font-medium">3 / 3</span></div>
                <div className="flex items-center justify-between"><span style={{ color: "var(--ink-2)" }}>C2 · Backend</span><span className="tnum font-medium"><span style={{ color: "var(--coral)" }}>2</span> / 3</span></div>
                <div className="flex items-center justify-between"><span style={{ color: "var(--ink-2)" }}>C3 · GPU + workers</span><span className="tnum font-medium"><span style={{ color: "var(--coral)" }}>4</span> / 5</span></div>
                <div className="flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--hairline)" }}><span className="flex items-center gap-1.5"><Dot s="error" /><span style={{ color: "var(--ink-2)" }}>Offline</span></span><span className="tnum font-medium" style={{ color: "var(--coral)" }}>2 nodes</span></div>
              </div>
            </Panel>

            <Panel className="overflow-hidden p-5" style={{ background: "var(--drench-lime)", border: "none" }}>
              <div className="mb-4 flex items-center justify-between" style={{ color: "#0b1e02" }}>
                <div className="flex items-center gap-2"><Server size={14} /><span className="text-[12.5px] font-semibold">Nodes</span></div>
                <span className="text-[11px]" style={{ opacity: 0.6 }}>colour = usage · click for debug</span>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                {CLUSTERS.map((cl) => (
                  <div key={cl.name}>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0b1e02", opacity: 0.6 }}>{cl.name}</div>
                    <div className="flex flex-col gap-1.5">
                      {cl.nodes.map((n) => {
                        const usage = n.v[n.v.length - 1] ?? 0;
                        return (
                          <button key={n.id} onClick={() => setOpenNode({ id: n.id, online: n.on })} className="flex items-center gap-2 rounded-[6px] px-1 py-0.5 text-left hover:underline" title={`${n.id} · ${n.on ? Math.round(usage * 100) + "% util · click for debug" : "DOWN — click for debug"}`}>
                            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={nodeDot(n.on, usage)} />
                            <span className="truncate text-[10.5px] font-medium tnum" style={{ color: n.on ? "#0b1e02" : "#7f1d1d" }}>{n.id}{!n.on && <span className="font-bold"> · down</span>}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3.5 text-[9.5px]" style={{ borderColor: "rgba(11,30,2,0.14)", color: "#0b1e02" }}>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={nodeDot(false, 0)} />offline</span>
                {([["0–15", 0.1], ["15–30", 0.3], ["30–50", 0.5], ["50–65", 0.65], ["65–85", 0.85], ["85–100%", 0.97]] as [string, number][]).map(([label, v]) => (
                  <span key={label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={nodeDot(true, v)} />{label}</span>
                ))}
              </div>
            </Panel>
          </div>
          ) : (
            <Panel className="mt-3 flex flex-col items-center justify-center gap-2 p-10 text-center">
              <Server size={18} style={{ color: "var(--ink-3)" }} />
              <div className="text-[12.5px] font-medium" style={{ color: "var(--ink-2)" }}>Per-node fleet telemetry pending</div>
              <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>MIT emits one worker today; the multi-node heatmap lands with #279</div>
            </Panel>
          )}

          {/* VRAM (donut + available) + live feed — queue moved to /service/mit#queue (always-huge = noise on overview) */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel className="p-5">
              <div className="mb-1 flex items-center gap-2"><Cpu size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">VRAM by model</span><span className="ml-auto text-[11px] tnum" style={{ color: "var(--ink-3)" }}>{m?.gpu ? `${vramUsed} / ${vramTotal} GB` : "—"}</span></div>
              {m?.gpu ? (
                <div className="flex items-center gap-3">
                  <VramDonut models={vramModels} totalGb={vramTotal} usedGb={vramUsed} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    {vramModels.map((vm, i) => (
                      <div key={vm.name} className="flex items-center gap-2 text-[11px]">
                        <span className="h-2 w-2 rounded-[3px]" style={{ background: VRAM_COLORS[i % VRAM_COLORS.length] }} />
                        <span className="flex-1 truncate" style={{ color: vm.leaked ? "var(--coral)" : "var(--ink-2)" }}>{vm.name}{vm.leaked && " · leak"}</span>
                        <span className="tnum" style={{ color: "var(--ink-3)" }}>{vm.v}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="h-2 w-2 rounded-[3px]" style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }} />
                      <span className="flex-1 truncate" style={{ color: "var(--ink-3)" }}>available</span>
                      <span className="tnum" style={{ color: "var(--ink-3)" }}>{Math.round((vramTotal - vramUsed) * 10) / 10}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No GPU telemetry</div>
              )}
            </Panel>
            <Panel className="p-5">
              <div className="mb-2.5 flex items-center gap-2"><Activity size={14} style={{ color: "var(--ink-2)" }} /><span className="text-[12.5px] font-semibold">Live feed</span></div>
              <div className="flex flex-col">
                {feed.length ? feed.map((e, i) => (
                  <div key={i} className="flex items-start gap-2.5 border-t py-2 first:border-0" style={{ borderColor: "var(--hairline)" }}>
                    <span className="mt-1"><Dot s={e.s} /></span>
                    <span className="flex-1 text-[11.5px] leading-snug">{e.text}</span>
                    <span className="text-[10px] tnum" style={{ color: "var(--ink-3)" }}>{mounted ? e.t : ""}</span>
                  </div>
                )) : <div className="py-6 text-center text-[11.5px]" style={{ color: "var(--ink-3)" }}>No events yet</div>}
              </div>
            </Panel>
          </div>

          {/* Traffic + SSE streams — cross-service infra (ported from :4100); no live source → mock-only / NoData */}
          {mock ? (
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <TrafficPanel />
              <StreamsPanel />
            </div>
          ) : (
            <Panel className="mt-3 flex flex-col items-center justify-center gap-1.5 p-8 text-center">
              <WifiOff size={16} style={{ color: "var(--ink-3)" }} />
              <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>Traffic &amp; stream telemetry — no live source yet (FE/BE #283/#282)</div>
            </Panel>
          )}

          <p className="mt-6 text-center text-[11px]" style={{ color: "var(--ink-3)" }}>MIT Staff Console · {mock ? "mockup data — set NEXT_PUBLIC_MOCKUP_MODE=false for live" : "live telemetry"} (DESIGN.md)</p>
          </>
          )}

          {view === "Frontend" && <NoDataView Icon={Activity} name="Frontend" tech="Next.js 16 · React 19" color="var(--accent-violet)" msg="Telemetry not wired — Frontend /status pending (#283). This service has no live source yet; the panel populates once the endpoint ships." />}
          {view === "Backend" && <NoDataView Icon={Server} name="Backend" tech="NestJS 11" color="var(--accent-amber)" msg="Telemetry not wired — Backend /status pending (#282). This service has no live source yet; the panel populates once the endpoint ships." />}
          {view === "MIT" && <MitView data={mitData} onOpenNode={setOpenNode} />}
        </main>
      </div>
      <NodePopup node={openNode} onClose={() => setOpenNode(null)} />
    </div>
  );
}
