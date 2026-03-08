"use client";

import { useEffect, useState } from "react";
import {
  MANGA_TRANSLATE_MODELS,
  MANGA_TRANSLATE_MODEL_KEY,
  type MangaTranslateModel,
  getMangaTranslateModelFromStorage,
} from "../lib/mangaTranslateModel";

const LABELS: Record<MangaTranslateModel, string> = {
  "gemini-2.5-flash": "2.5 Flash",
  "gemini-2.5-flash-lite": "2.5 Flash Lite",
};

export default function DevMangaTranslateModelToggle() {
  const [mounted, setMounted] = useState(false);
  const [model, setModel] = useState<MangaTranslateModel>("gemini-2.5-flash");

  useEffect(() => {
    setMounted(true);
    setModel(getMangaTranslateModelFromStorage());
  }, []);

  if (!mounted) return null;

  const enabled =
    process.env.NEXT_PUBLIC_MANGA_TRANSLATE_DEV_TOOLS === "true" ||
    process.env.NEXT_PUBLIC_IMAGE_CACHE_DEV_TOOLS === "true";
  if (!enabled) return null;

  const changeModel = (next: MangaTranslateModel) => {
    setModel(next);
    localStorage.setItem(MANGA_TRANSLATE_MODEL_KEY, next);
  };

  return (
    <div className="fixed bottom-16 right-4 z-9999 rounded-xl border border-white/15 bg-black/75 p-2 backdrop-blur-sm">
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-white/70">MANGA AI MODEL</p>
      <div className="flex items-center gap-1">
        {MANGA_TRANSLATE_MODELS.map((option) => {
          const active = model === option;
          return (
            <button
              key={option}
              onClick={() => changeModel(option)}
              className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                active
                  ? "border-blue-400/70 bg-blue-500/20 text-blue-200"
                  : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
              title={`เลือกโมเดล ${LABELS[option]} สำหรับระบบแปลมังงะในตอน (Dev)`}
              aria-label={`เลือกโมเดล ${LABELS[option]} สำหรับระบบแปลมังงะในตอน (Dev)`}
            >
              {LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
