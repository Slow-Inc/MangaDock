"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, AlertTriangle } from "lucide-react";
import { SERVICE_STATUS_COLOR as STATUS_COLOR, type Service } from "@/lib/services";

const EASE = [0.16, 1, 0.3, 1] as const; // ease-out-expo

export function ServiceModal({
  service,
  onClose,
  onViewDetails,
}: {
  service: Service | null;
  onClose: () => void;
  onViewDetails: (id: string) => void;
}) {
  useEffect(() => {
    if (!service) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [service, onClose]);

  return (
    <AnimatePresence>
      {service && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* backdrop */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
          />

          {/* dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${service.name} overview`}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="relative w-full max-w-[420px] overflow-hidden rounded-[var(--radius)]"
            style={{ background: "var(--panel)", border: "1px solid var(--panel-hairline)", boxShadow: "var(--shadow-panel)" }}
          >
            {/* header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--panel-hairline)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: `color-mix(in oklch, ${service.color} 16%, transparent)` }}>
                  <service.Icon size={19} strokeWidth={1.85} style={{ color: service.color }} />
                </span>
                <div className="leading-tight">
                  <div className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
                    {service.name}
                  </div>
                  <div className="tnum mt-0.5 text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
                    {service.tech}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5" style={{ background: `color-mix(in oklch, ${STATUS_COLOR[service.status]} 14%, transparent)` }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[service.status] }} />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: STATUS_COLOR[service.status] }}>
                    {service.status}
                  </span>
                </span>
                <button
                  onClick={onClose}
                  aria-label="Close overview"
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-80"
                  style={{ color: "var(--panel-ink-3)" }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 gap-px px-5 py-4">
              {service.stats.map((st) => (
                <div key={st.label} className="py-1.5">
                  <div className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--panel-ink-3)" }}>
                    {st.label}
                  </div>
                  <div className="tnum mt-0.5 text-[13px] font-semibold" style={{ color: "var(--panel-ink)" }}>
                    {st.value}
                  </div>
                </div>
              ))}
            </div>

            {/* error block */}
            {service.errors > 0 && service.errorLines && (
              <div className="mx-5 mb-4 rounded-xl px-3.5 py-3" style={{ background: "color-mix(in oklch, var(--error) 8%, transparent)", border: "1px solid color-mix(in oklch, var(--error) 24%, transparent)" }}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={12} style={{ color: "var(--error)" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "var(--error)" }}>
                    {service.errors} active error
                  </span>
                </div>
                {service.errorLines.map((line, i) => (
                  <div key={i} className="tnum text-[10.5px] leading-relaxed" style={{ color: "var(--panel-ink-2)" }}>
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* footer */}
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-[12.5px] font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--panel-ink-2)", border: "1px solid var(--panel-hairline)" }}
              >
                Close
              </button>
              <button
                onClick={() => onViewDetails(service.id)}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition-transform hover:-translate-y-px"
                style={{ background: "var(--panel-ink)", color: "var(--panel)" }}
              >
                View details
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
