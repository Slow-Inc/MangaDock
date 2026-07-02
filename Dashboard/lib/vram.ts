/** Per-model VRAM accounting for the MIT host GPU. Pure — unit-tested in vram.test.ts. */

export interface VramModel {
  id: string;
  label: string; // "Detection"
  sublabel: string; // "AnimeText YOLO"
  gb: number; // local VRAM held resident; 0 for remote models
  color: string; // CSS custom property
  remote?: boolean; // runs off-box (9arm gateway) — holds no local VRAM
}

export interface VramRow extends VramModel {
  pct: number; // share of total VRAM, 0–100 (1 decimal)
}

export interface VramSummary {
  rows: VramRow[];
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usedPct: number; // 0–100 (1 decimal)
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeVram(models: VramModel[], totalGb: number): VramSummary {
  const rows = models.map((m) => ({ ...m, pct: round1((m.gb / totalGb) * 100) }));
  const usedGb = round1(models.reduce((sum, m) => sum + m.gb, 0));
  const freeGb = round1(totalGb - usedGb);
  const usedPct = round1((usedGb / totalGb) * 100);
  return { rows, totalGb, usedGb, freeGb, usedPct };
}
