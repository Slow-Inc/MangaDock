"use client";

import { useMemo, useState } from "react";
import { filterEvents, type ActivityFilter } from "@/lib/events";
import { useLang } from "@/components/lang-provider";

const EVENTS: { kind: string; text: string; t: string }[] = [
  { kind: "error", text: "Translate timeout — 9arm model not responding", t: "16:10:14" },
  { kind: "processing", text: "translating · custom_openai", t: "16:08:44" },
  { kind: "success", text: "ocr · 8 lines + 1 SFX", t: "16:08:42" },
  { kind: "success", text: "detection · 8 regions", t: "16:08:41" },
  { kind: "writing", text: "Gal Yome no Himitsu · ch1 p3 · xeno", t: "16:08:41" },
  { kind: "success", text: "backend · cache L1 hit · 3 ms", t: "16:08:40" },
  { kind: "success", text: "frontend · /reader/123 · 12 ms", t: "16:08:39" },
];

const EVENT_COLOR: Record<string, string> = {
  error: "var(--error)",
  processing: "var(--processing)",
  success: "var(--success)",
  writing: "var(--writing)",
};

export function LiveActivity() {
  const { t } = useLang();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const visible = useMemo(() => filterEvents(EVENTS, filter), [filter]);
  const hidden = EVENTS.length - filterEvents(EVENTS, "major").length;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: "var(--success)", opacity: 0.6 }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
          </span>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-2)" }}>
            {t("liveactivity.title")}
          </h2>
        </div>
        <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
          {(["all", "major"] as ActivityFilter[]).map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold capitalize transition-colors"
                style={{ background: on ? "var(--panel-3)" : "transparent", color: on ? "var(--ink)" : "var(--ink-3)" }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>
      <div className="-mr-1 flex flex-col gap-0.5 overflow-y-auto pr-1">
        {visible.map((e, i) => (
          <div
            key={`${e.t}-${e.text}`}
            className="flex items-start gap-2.5 rounded-lg px-2 py-2"
            style={{ background: i === 0 && e.kind === "error" ? "color-mix(in oklch, var(--error) 8%, transparent)" : "transparent" }}
          >
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: EVENT_COLOR[e.kind] }} />
            <span className="flex-1 text-[12px] leading-snug" style={{ color: "var(--ink)" }}>
              {e.text}
            </span>
            <span className="tnum mt-px text-[10px]" style={{ color: "var(--ink-3)" }}>
              {e.t}
            </span>
          </div>
        ))}
      </div>
      {filter === "major" && hidden > 0 && (
        <div className="mt-2 pt-2 text-[10.5px]" style={{ color: "var(--ink-3)", borderTop: "1px solid var(--hairline)" }}>
          {hidden} routine events hidden
        </div>
      )}
    </>
  );
}
