"use client";

import Mascot from "../mascot/Mascot";
import { stageSegments, type StageInfo } from "../../lib/translationStages";

/**
 * Staged progress for an MIT translation (redesign spec, Epic B #774): the reader's droid at work, the five
 * pipeline steps as a segmented bar, the running clock and the honest ETA / cold-start note. Replaces a
 * single line of text that left a 20–60 s wait reading as a frozen spinner.
 */
export default function TranslateProgress({
  title,
  stage,
  elapsedSec,
  subline,
  failed,
}: {
  title: string;
  stage: StageInfo | null;
  elapsedSec: number;
  subline: string | null;
  failed: number;
}) {
  const segments = stageSegments(stage);
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-[17rem] items-center gap-3 rounded-[var(--r3)] border border-line bg-surface/90 py-2.5 pl-2 pr-4 shadow-[0_18px_40px_-16px_rgb(0_0_0/.6)] backdrop-blur-md"
    >
      <Mascot area="reader" state="working" size={44} interactive={false} label="กำลังแปล" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[0.8125rem] font-medium text-ink">{title}</span>
          {elapsedSec > 0 ? <span aria-hidden className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-ink-3">{elapsedSec}s</span> : null}
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {segments.map((s, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-[var(--t2)] ease-[var(--ease)] ${
                s === "done" ? "bg-accent" : s === "active" ? "animate-pulse bg-accent/60" : "bg-fill"
              }`}
            />
          ))}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3 text-[0.6875rem]">
          <span className="truncate text-ink-2">
            {stage ? `${stage.text} · ${stage.step}/${stage.total}` : "กำลังเริ่ม"}
          </span>
          {failed > 0 ? <span className="shrink-0 text-danger">ไม่สำเร็จ {failed}</span> : null}
        </div>
        {subline ? <p className="mt-0.5 truncate text-[0.6875rem] text-ink-3">{subline}</p> : null}
      </div>
    </div>
  );
}
