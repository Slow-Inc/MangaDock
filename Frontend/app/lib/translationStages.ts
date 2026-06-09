/**
 * MIT stage → user-facing Thai label (translation UX).
 *
 * Stage ids arrive over the batch SSE stream as `{type:"progress", stage}`
 * events, originating from MIT's per-stage progress hooks. The 20-60s
 * per-page wait shows which of the 5 pipeline steps is actually running,
 * so the wait never reads as a frozen spinner.
 */

export type StageInfo = { text: string; step: number; total: number };

const TOTAL = 5;

const STAGES: Record<string, StageInfo> = {
  started: { text: "ตรวจหาข้อความ", step: 1, total: TOTAL },
  detection: { text: "ตรวจหาข้อความ", step: 1, total: TOTAL },
  ocr: { text: "อ่านข้อความ", step: 2, total: TOTAL },
  textline_merge: { text: "อ่านข้อความ", step: 2, total: TOTAL },
  translating: { text: "แปลด้วย AI", step: 3, total: TOTAL },
  "mask-generation": { text: "ลบข้อความเดิม", step: 4, total: TOTAL },
  inpainting: { text: "ลบข้อความเดิม", step: 4, total: TOTAL },
  rendering: { text: "วาดข้อความแปล", step: 5, total: TOTAL },
};

export function stageLabel(stage: string | null | undefined): StageInfo | null {
  if (!stage) return null;
  return STAGES[stage] ?? null;
}

/** ETA seconds → short Thai text. Rounds minutes UP — never promise less
 *  time than likely (a wait that beats the estimate feels fast; the reverse
 *  feels broken). */
export function formatEta(sec: number): string {
  if (sec <= 0) return "อีกครู่เดียว";
  if (sec < 60) return `~${sec} วิ`;
  return `~${Math.ceil(sec / 60)} นาที`;
}

/** Main line of the floating translation-status pill (#164). The pill is
 *  view-mode agnostic — paged and continuous render the same status, so
 *  switching modes never makes a running translation look idle. */
export function pillMainText(
  batchRunning: boolean,
  done: number,
  total: number,
  currentPageNumber: number,
): string {
  return batchRunning
    ? `แปลไปแล้ว ${done}/${total} หน้า`
    : `กำลังแปลหน้า ${currentPageNumber}`;
}
