"use client";

import { Boxes, Cloud, Database, HardDrive, Cpu, Globe, CreditCard, type LucideIcon } from "lucide-react";
import { rollupHealth, type Health, type Subsystem } from "@/lib/health";
import { useLang } from "@/components/lang-provider";

const HEALTH_COLOR: Record<Health, string> = { up: "var(--success)", degraded: "var(--processing)", down: "var(--error)" };
const KIND_ICON: Record<string, LucideIcon> = {
  gateway: Cloud,
  cache: Database,
  db: Database,
  storage: HardDrive,
  gpu: Cpu,
  disk: HardDrive,
  payment: CreditCard,
  dep: Globe,
};

export function SubsystemBoard({ subsystems }: { subsystems: Subsystem[] }) {
  const { t } = useLang();
  const r = rollupHealth(subsystems);
  const oc = HEALTH_COLOR[r.overall];

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <Boxes size={15} strokeWidth={1.85} style={{ color: "var(--panel-ink-2)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            {t("subsystems.title")}
          </h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5" style={{ background: `color-mix(in oklch, ${oc} 14%, transparent)` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: oc }} />
          <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: oc }}>
            {r.overall === "up" ? "all healthy" : `${r.down} down · ${r.degraded} degraded`}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 px-5 pb-4 sm:grid-cols-3 xl:grid-cols-4">
        {r.subsystems.map((sub) => {
          const c = HEALTH_COLOR[sub.health];
          const Icon = KIND_ICON[sub.kind] ?? Globe;
          const isDown = sub.health === "down";
          return (
            <div key={sub.id} className="rounded-xl px-3 py-2.5" style={{ background: "var(--panel-2)", border: `1px solid ${isDown ? "color-mix(in oklch, var(--error) 38%, transparent)" : "var(--panel-hairline)"}` }}>
              <div className="flex items-center justify-between">
                <Icon size={13} strokeWidth={1.85} style={{ color: "var(--panel-ink-3)" }} />
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
              </div>
              <div className="mt-1.5 text-[12px] font-semibold leading-tight" style={{ color: "var(--panel-ink)" }}>
                {sub.label}
              </div>
              <div className="mt-0.5 truncate text-[10.5px]" style={{ color: isDown ? "var(--error)" : "var(--panel-ink-3)" }} title={sub.detail}>
                {sub.detail}
              </div>
              {sub.latencyMs != null && sub.latencyMs > 0 && (
                <div className="tnum mt-0.5 text-[10px]" style={{ color: "var(--panel-ink-3)" }}>
                  {sub.latencyMs} ms
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
