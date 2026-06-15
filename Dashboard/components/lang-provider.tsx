"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { translate, type Lang } from "@/lib/i18n";

interface LangCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangCtx = createContext<LangCtxValue>({ lang: "en", setLang: () => {}, t: (k) => k });

/** `initial` comes from the `lang` cookie read server-side in the root layout, so SSR and the
 *  first client render agree (no hydration mismatch, no flash). The toggle persists via the cookie. */
export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  function setLang(l: Lang) {
    setLangState(l);
    document.cookie = `lang=${l};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = l;
  }

  const t = (key: string) => translate(lang, key);

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
