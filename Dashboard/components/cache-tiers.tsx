"use client";

import { Layers, Database } from "lucide-react";
import { summarizeCacheTiers, formatAge, type CacheTiersInput } from "@/lib/cache-tiers";
import { NODE_STALE_MS, NODE_DOWN_MS } from "@/lib/cluster";

function fmtBytes(b: number) {
  const mb = b / 1e6;
  return mb >= 1000 ? `${(mb / 1000).toFixed(2)} GB` : `${Math.round(mb)} MB`;
}

function ageColor(ms: number) {
  return ms >= NODE_DOWN_MS ? "var(--error)" : ms >= NODE_STALE_MS ? "var(--processing)" : "var(--panel-ink)";
}

export function CacheTiers({ input, now }: { input: CacheTiersInput; now: number }) {
  const c = summarizeCacheTiers(input, now);

  const th = "px-2 py-2 text-[10px] font-medium uppercase tracking-wide";
  const td = "px-2 py-2.5 text-[12px]";

  return (
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Layers size={15} strokeWidth={1.85} style={{ color: "var(--c-render)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            Cache tiers · L1 / L2 / L3
          </h2>
        </div>
        <span className="text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
          updated times read per tier
        </span>
      </div>

      {/* L2 — shared (Redis) */}
      <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
        <span className="flex items-center gap-2">
          <Database size={13} strokeWidth={1.85} style={{ color: "var(--error)" }} />
          <span className="text-[12px] font-semibold" style={{ color: "var(--panel-ink)" }}>
            L2 · Redis
          </span>
          <span className="rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide" style={{ background: "color-mix(in oklch, var(--error) 16%, transparent)", color: "var(--error)" }}>
            shared
          </span>
        </span>
        <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
          updated <span style={{ color: ageColor(c.l2.ageMs) }}>{formatAge(c.l2.ageMs)}</span> · {c.l2.entries.toLocaleString()} entries
        </span>
      </div>

      {/* per-node L1 + L3 table */}
      <div className="overflow-x-auto px-5">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--panel-hairline)", color: "var(--panel-ink-3)" }}>
              <th className={`${th} text-left`}>Node</th>
              <th className={`${th} text-left`}>L1 · updated</th>
              <th className={`${th} text-right`}>L1 entries</th>
              <th className={`${th} text-left`}>L3 · updated</th>
              <th className={`${th} text-right`}>L3 files</th>
              <th className={`${th} text-right`}>L3 size</th>
            </tr>
          </thead>
          <tbody>
            {c.nodes.map((n, i) => (
              <tr key={n.nodeId} style={{ borderBottom: i < c.nodes.length - 1 ? "1px solid var(--panel-hairline)" : "none" }}>
                <td className={`${td} tnum font-semibold`} style={{ color: "var(--panel-ink)" }}>
                  {n.nodeId}
                </td>
                <td className={`${td} tnum`} style={{ color: ageColor(n.l1.ageMs) }}>
                  {formatAge(n.l1.ageMs)}
                </td>
                <td className={`${td} tnum text-right`} style={{ color: "var(--panel-ink-2)" }}>
                  {n.l1.entries.toLocaleString()}
                </td>
                <td className={`${td} tnum`} style={{ color: ageColor(n.l3.ageMs) }}>
                  {formatAge(n.l3.ageMs)}
                </td>
                <td className={`${td} tnum text-right`} style={{ color: "var(--panel-ink-2)" }}>
                  {n.l3.files.toLocaleString()}
                </td>
                <td className={`${td} tnum text-right`} style={{ color: "var(--panel-ink-2)" }}>
                  {fmtBytes(n.l3.bytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* footer */}
      <div className="px-5 pb-4 pt-3 text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
        L1 in-process (per node) · L2 Redis (shared) · L3 disk (per node) — totals{" "}
        <span className="tnum" style={{ color: "var(--panel-ink-2)" }}>
          {c.totals.l3Files.toLocaleString()} files · {fmtBytes(c.totals.l3Bytes)}
        </span>{" "}
        across {c.nodes.length} nodes
      </div>
    </section>
  );
}
