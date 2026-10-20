"use client";

import { useEffect, useState } from "react";
import ModelBadge from "./ModelBadge";
import Loader from "./ui/Loader";
import { translateDescription } from "../lib/translateDescription";
import { stripMarkdown } from "../lib/markdownText";

const truncate = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length)}...` : text;

export default function HeroDescription({ description }: { description: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [model, setModel] = useState<string | undefined>();
  const [translating, setTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!description) return;
    setTranslating(true);
    translateDescription(description)
      .then(({ text, model }) => {
        setTranslated(text);
        setModel(model);
        setTranslating(false);
      })
      .catch(() => setTranslating(false));
  }, [description]);

  const displayText = translated && !showOriginal ? translated : description;

  return (
    <div className="space-y-1.5">
      <p className="text-sm leading-relaxed text-ink md:text-base">
        {truncate(stripMarkdown(displayText), 210)}
      </p>
      <div className="flex items-center gap-2 h-5">
        {translating && (
          <>
            <Loader context="inline" label="กำลังแปลคำโปรย" className="text-ink-3" />
            <ModelBadge model={model} small />
          </>
        )}
        {translated && !translating && (
          <>
            <ModelBadge model={model} small />
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className="text-[10px] text-ink-2 underline underline-offset-2 hover:text-ink transition-colors"
            >
              {showOriginal ? "แสดงคำแปล" : "ต้นฉบับ"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
