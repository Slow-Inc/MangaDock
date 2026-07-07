import { ScanText, Type, Languages, Eraser, ImageIcon, type LucideIcon } from "lucide-react";

export type StageStatus = "idle" | "processing" | "success" | "error";

export interface Stage {
  id: string;
  label: string;
  sublabel: string;
  color: string; // CSS custom property
  Icon: LucideIcon;
}

/** The MIT translation pipeline, in flow order. */
export const STAGES: Stage[] = [
  { id: "detection", label: "Detection", sublabel: "AnimeText YOLO", color: "var(--c-detect)", Icon: ScanText },
  { id: "ocr", label: "OCR", sublabel: "manga-ocr · VLM", color: "var(--c-ocr)", Icon: Type },
  { id: "translate", label: "Translate", sublabel: "qwen3.6 · 9arm", color: "var(--c-translate)", Icon: Languages },
  { id: "inpaint", label: "Inpaint", sublabel: "LaMa · Flux Klein", color: "var(--c-inpaint)", Icon: Eraser },
  { id: "render", label: "Render", sublabel: "patch composite", color: "var(--c-render)", Icon: ImageIcon },
];

export const STATUS_LABEL: Record<StageStatus, string> = {
  idle: "Idle",
  processing: "Processing",
  success: "Success",
  error: "Error",
};

export const STATUS_COLOR: Record<StageStatus, string> = {
  idle: "var(--idle)",
  processing: "var(--processing)",
  success: "var(--success)",
  error: "var(--error)",
};
