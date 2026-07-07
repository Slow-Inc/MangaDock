"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Network, Crown, Server } from "lucide-react";
import { summarizeCluster, type NodeHealth, type NodeRecord, type NodeStatus } from "@/lib/cluster";
import { NodeDetailModal } from "@/components/node-detail-modal";

const HEALTH_COLOR = { healthy: "var(--success)", degraded: "var(--processing)", down: "var(--error)" } as const;
const NODE_COLOR: Record<NodeHealth, string> = {
  up: "var(--success)",
  stale: "var(--processing)",
  down: "var(--error)",
};

export function NodeCluster({ nodes, now }: { nodes: NodeRecord[]; now: number }) {
  const c = summarizeCluster(nodes, now);
  const hc = HEALTH_COLOR[c.health];
  const [selected, setSelected] = useState<NodeStatus | null>(null);

  return (
    <>
    <section
      className="theme-tx overflow-hidden rounded-[var(--radius)]"
      style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <Network size={15} strokeWidth={1.85} style={{ color: "var(--backend)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            Cluster · backend nodes
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
            {c.live}/{c.total} live
          </span>
          <span className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5" style={{ background: `color-mix(in oklch, ${hc} 14%, transparent)` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: hc }} />
            <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: hc }}>
              {c.health}
            </span>
          </span>
        </div>
      </div>

      {/* node cards + L2 bus */}
      <div className="px-5 pb-2">
        <div className="flex items-stretch">
          {c.nodes.map((n) => {
            const nc = NODE_COLOR[n.status];
            const isLeader = n.id === c.leaderId;
            return (
              <div key={n.id} className="flex flex-1 flex-col items-center">
                <button
                  type="button"
                  onClick={() => setSelected(n)}
                  title="View node status"
                  className="relative w-full rounded-xl px-3 py-3 text-left transition-transform hover:-translate-y-px"
                  style={{
                    margin: "0 5px",
                    background: isLeader ? "color-mix(in oklch, var(--backend) 8%, var(--panel-2))" : "var(--panel-2)",
                    border: `1px solid ${isLeader ? "color-mix(in oklch, var(--backend) 42%, transparent)" : "var(--panel-hairline)"}`,
                  }}
                >
                  {isLeader && (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: "0 0 0 1px color-mix(in oklch, var(--backend) 52%, transparent)" }}
                      animate={{ opacity: [0.3, 0.85, 0.3] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Server size={13} strokeWidth={1.85} style={{ color: "var(--panel-ink-2)" }} />
                      <span className="tnum text-[11.5px] font-semibold" style={{ color: "var(--panel-ink)" }}>
                        {n.id}
                      </span>
                    </span>
                    <span className="relative flex h-2 w-2">
                      {n.status === "up" && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: nc, opacity: 0.5 }} />
                      )}
                      <span className="relative h-2 w-2 rounded-full" style={{ background: nc }} />
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5">
                    {isLeader ? (
                      <span className="flex items-center gap-1 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide" style={{ background: "color-mix(in oklch, var(--backend) 20%, transparent)", color: "var(--backend)" }}>
                        <Crown size={9} /> leader
                      </span>
                    ) : (
                      <span className="rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide" style={{ border: "1px solid var(--panel-hairline)", color: "var(--panel-ink-3)" }}>
                        follower
                      </span>
                    )}
                    <span className="tnum text-[10px]" style={{ color: nc }}>
                      {n.status} · {(n.ageMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  <div className="tnum mt-2 flex items-center justify-between text-[10.5px]" style={{ color: "var(--panel-ink-3)" }}>
                    <span>L1 {n.l1Entries.toLocaleString()}</span>
                    {n.dirtyQueue != null && (
                      <span style={{ color: "var(--processing)" }}>dirty {n.dirtyQueue}</span>
                    )}
                  </div>
                </button>

                {/* stem down to the bus */}
                <div className="relative h-5 w-px" style={{ background: "var(--panel-hairline)" }}>
                  {n.status === "up" && (
                    <motion.span
                      className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full"
                      style={{ background: nc, boxShadow: `0 0 6px ${nc}` }}
                      animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeIn" }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* L2 · Redis pub/sub bus */}
        <div className="relative mx-1.5 mt-0 flex h-7 items-center justify-center overflow-hidden rounded-lg" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
          {[0, 1].map((k) => (
            <motion.span
              key={k}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
              style={{ background: "var(--error)", boxShadow: "0 0 8px var(--error)" }}
              animate={{ left: ["-2%", "102%"], opacity: [0, 1, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear", delay: k * 1.2 }}
            />
          ))}
          <span className="tnum relative text-[10.5px] font-medium" style={{ color: "var(--panel-ink-2)" }}>
            L2 · Redis · pub/sub bus
          </span>
        </div>
      </div>

      {/* diagnosis */}
      <div className="flex items-start gap-2 px-5 pb-4 pt-2 text-[11.5px]" style={{ color: "var(--panel-ink-2)" }}>
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hc }} />
        <span>
          {c.leaderHealthy ? (
            <>
              Leader <b style={{ color: "var(--panel-ink)" }}>{c.leaderId}</b> healthy — drains dirty queue → L3 + Supabase.
            </>
          ) : (
            <>No healthy leader — election in progress.</>
          )}{" "}
          {c.nodes
            .filter((n) => n.status !== "up")
            .map((n) => `${n.id} ${n.status} (heartbeat ${(n.ageMs / 1000).toFixed(1)}s)`)
            .join(" · ")}
          <span style={{ color: "var(--panel-ink-3)" }}> · status read from L2 (Redis) · click a node for detail</span>
        </span>
      </div>
    </section>
    <NodeDetailModal node={selected} leaderId={c.leaderId} onClose={() => setSelected(null)} />
    </>
  );
}
