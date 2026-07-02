"use client";

import { useLang } from "@/components/lang-provider";
import type { Lang } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
      {(["en", "th"] as Lang[]).map((l) => {
        const on = lang === l;
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-label={l === "en" ? "English" : "ไทย"}
            className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-colors"
            style={{ background: on ? "color-mix(in oklch, var(--ink) 9%, transparent)" : "transparent", color: on ? "var(--ink)" : "var(--ink-3)" }}
          >
            {l === "en" ? "EN" : "ไทย"}
          </button>
        );
      })}
    </div>
  );
}
