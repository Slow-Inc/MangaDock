"use client";

import { useEffect, useState } from "react";
import GeminiBadge from "./GeminiBadge";

const API_BASE = "/api/proxy";

const truncate = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length)}...` : text;

export default function HeroDescription({ description }: { description: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!description) return;
    setTranslating(true);
    fetch(`${API_BASE}/books/translate?text=${encodeURIComponent(description)}`)
      .then((r) => r.json())
      .then((d: { translatedText: string; translated: boolean }) => {
        if (d.translated) setTranslated(d.translatedText);
        setTranslating(false);
      })
      .catch(() => setTranslating(false));
  }, [description]);

  const displayText = translated && !showOriginal ? translated : description;

  return (
    <div className="space-y-1.5">
      <p className="text-sm leading-relaxed text-white/85 md:text-base">
        {truncate(displayText, 210)}
      </p>
      <div className="flex items-center gap-2 h-5">
        {translating && (
          <p className="text-[10px] text-white/40">กำลังแปล...</p>
        )}
        {translated && !translating && (
          <>
            <GeminiBadge small />
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className="text-[10px] text-white/40 underline underline-offset-2 hover:text-white/70 transition-colors"
            >
              {showOriginal ? "แสดงคำแปล" : "ต้นฉบับ"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
