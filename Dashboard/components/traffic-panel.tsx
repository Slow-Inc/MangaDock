"use client";

import { Users, Network } from "lucide-react";
import { summarizeBandwidth, type BwNode, type BwService } from "@/lib/bandwidth";
import { useLang } from "@/components/lang-provider";

export function TrafficPanel({
  users,
  services,
  nodes,
}: {
  users: { active: number; total: number };
  services: BwService[];
  nodes: BwNode[];
}) {
  const { t } = useLang();
  const b = summarizeBandwidth(services, nodes);

  const Kpi = ({ Icon, label, value, color }: { Icon: typeof Users; label: string; value: string; color: string }) => (
    <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center gap-1.5">
        <Icon size={12} strokeWidth={1.85} style={{ color }} />
        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{label}</span>
      </div>
      <div className="tnum mt-1 text-[18px] font-semibold" style={{ color: "var(--panel-ink)" }}>{value}</div>
    </div>
  );

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <Network size={15} strokeWidth={1.85} style={{ color: "var(--c-render)" }} />
        <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>{t("traffic.title")}</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-2 px-5 sm:grid-cols-3">
        <Kpi Icon={Users} label={t("traffic.activeUsers")} value={users.active.toLocaleString()} color="var(--success)" />
        <Kpi Icon={Users} label={t("traffic.totalUsers")} value={users.total.toLocaleString()} color="var(--panel-ink-2)" />
        <Kpi Icon={Network} label={t("traffic.totalBandwidth")} value={`↓${b.totalDown} ↑${b.totalUp} Mbps`} color="var(--c-render)" />
      </div>

      {/* bandwidth by service → backend nodes */}
      <div className="px-5 pb-4 pt-3.5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>{t("traffic.byService")}</div>
        {b.services.map((s) => (
          <div key={s.id} className="py-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[12px] font-medium" style={{ color: "var(--panel-ink)" }}>{s.name}</span>
              </span>
              <span className="tnum text-[11px]" style={{ color: "var(--panel-ink-3)" }}>↓{s.down} ↑{s.up} · {s.pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
            </div>

            {/* Backend → per-node breakdown */}
            {s.id === "backend" && (
              <div className="mt-2 pl-4">
                <div className="mb-1 text-[9.5px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>nodes</div>
                {b.nodes.map((n) => (
                  <div key={n.nodeId} className="py-1">
                    <div className="flex items-center justify-between">
                      <span className="tnum text-[10.5px]" style={{ color: "var(--panel-ink-2)" }}>{n.nodeId}</span>
                      <span className="tnum text-[10px]" style={{ color: "var(--panel-ink-3)" }}>↓{n.down} ↑{n.up} · {n.pct}%</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${n.pct}%`, background: "color-mix(in oklch, var(--backend) 75%, transparent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
