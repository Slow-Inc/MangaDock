"use client";

import { Inbox, AlertTriangle } from "lucide-react";
import { summarizeQueue, type JobState, type QueueJob } from "@/lib/queue";
import { useLang } from "@/components/lang-provider";

const STATE_COLOR: Record<JobState, string> = {
  queued: "var(--idle)",
  running: "var(--processing)",
  done: "var(--success)",
  failed: "var(--error)",
};
const s = (ms: number) => `${(ms / 1000).toFixed(0)}s`;

export function TranslateQueue({ jobs, now }: { jobs: QueueJob[]; now: number }) {
  const { t } = useLang();
  const q = summarizeQueue(jobs, now);
  const th = "px-2 py-2 text-[10px] font-medium uppercase tracking-wide";
  const td = "px-2 py-2.5 text-[12px]";

  return (
    <section className="theme-tx overflow-hidden rounded-[var(--radius)]" style={{ background: "var(--panel)", boxShadow: "var(--shadow-panel)", border: "1px solid var(--panel-hairline)" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Inbox size={15} strokeWidth={1.85} style={{ color: "var(--c-translate)" }} />
          <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--panel-ink)" }}>
            {t("queue.title")}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide">
          <span style={{ color: "var(--processing)" }}>{q.running} running</span>
          <span style={{ color: "var(--panel-ink-3)" }}>·</span>
          <span style={{ color: "var(--panel-ink-2)" }}>{q.queued} queued</span>
          {q.stuckCount > 0 && (
            <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background: "color-mix(in oklch, var(--error) 16%, transparent)", color: "var(--error)" }}>
              <AlertTriangle size={10} /> {q.stuckCount} stuck
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto px-5 pb-1">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--panel-hairline)", color: "var(--panel-ink-3)" }}>
              <th className={`${th} text-left`}>Job</th>
              <th className={`${th} text-left`}>Requester</th>
              <th className={`${th} text-left`}>Target</th>
              <th className={`${th} text-left`}>State</th>
              <th className={`${th} text-right`}>Time</th>
            </tr>
          </thead>
          <tbody>
            {q.jobs.map((j, i) => (
              <tr key={j.id} style={{ borderBottom: i < q.jobs.length - 1 ? "1px solid var(--panel-hairline)" : "none", background: j.stuck ? "color-mix(in oklch, var(--error) 7%, transparent)" : "transparent" }}>
                <td className={`${td} tnum`} style={{ color: "var(--panel-ink-2)" }}>{j.id}</td>
                <td className={`${td}`} style={{ color: "var(--panel-ink)" }}>{j.user}</td>
                <td className={`${td} tnum`} style={{ color: "var(--panel-ink-2)" }}>{j.manga} · {j.chapter} · p{j.page}</td>
                <td className={td}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATE_COLOR[j.state] }} />
                    <span className="text-[11px]" style={{ color: STATE_COLOR[j.state] }}>
                      {j.state}{j.stage ? ` · ${j.stage}` : ""}
                    </span>
                  </span>
                </td>
                <td className={`${td} tnum text-right`} style={{ color: j.stuck ? "var(--error)" : "var(--panel-ink-2)" }}>
                  {j.state === "running" ? `running ${s(j.runMs)}` : j.state === "queued" ? `waiting ${s(j.waitMs)}` : j.state}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 pb-4 pt-2.5 text-[11px]" style={{ color: "var(--panel-ink-3)" }}>
        oldest wait <span className="tnum" style={{ color: "var(--panel-ink-2)" }}>{s(q.oldestWaitMs)}</span> · {q.done} done · {q.failed} failed
      </div>
    </section>
  );
}
