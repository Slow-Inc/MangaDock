'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lang } from './lang-context';
import { needsTranslation, partNeedsTranslation, splitParts } from './markdown';
import { translatePart } from './translateDoc';

export type TranslationStatus = 'off' | 'translating' | 'done' | 'partial' | 'failed';

interface Result { text: string | null } // null = this part could not be translated; the original stays
const CONCURRENCY = 4; // well under the backend's 30 requests a minute; one part takes ~25-40 s
const NONE: Record<number, Result> = {};

/**
 * Shows `content` in `lang`, translating it when it is not already (a document written in one language
 * only). Parts arrive one by one and replace their original in place; whatever has not arrived yet, or
 * failed, is shown as written.
 */
export function useDocTranslation(file: string, content: string, lang: Lang) {
  const need = useMemo(() => needsTranslation(content, lang), [content, lang]);
  const parts = useMemo(() => (need ? splitParts(content) : []), [need, content]);
  const todo = useMemo(() => parts.map((p, i) => (partNeedsTranslation(p, lang) ? i : -1)).filter(i => i >= 0), [parts, lang]);

  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(0); // requests currently waiting out the backend's rate limit
  const runKey = `${file}|${lang}|${attempt}`;
  const [state, setState] = useState<{ key: string; results: Record<number, Result> }>({ key: '', results: {} });

  useEffect(() => {
    if (todo.length === 0) return;
    const ctrl = new AbortController();
    let next = 0;
    const record = (i: number, text: string | null) => {
      if (ctrl.signal.aborted) return;
      setState(s => ({ key: runKey, results: { ...(s.key === runKey ? s.results : {}), [i]: { text } } }));
    };
    const worker = async () => {
      while (next < todo.length && !ctrl.signal.aborted) {
        const i = todo[next++];
        try {
          const translated = await translatePart(parts[i].text, lang, ctrl.signal, w => setWaiting(n => Math.max(0, n + (w ? 1 : -1))));
          record(i, translated === null ? null : parts[i].restore(translated));
        } catch {
          record(i, null);
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
    return () => ctrl.abort();
  }, [runKey, parts, todo, lang]);

  const results = state.key === runKey ? state.results : NONE;
  const finished = Object.keys(results).length;
  const failed = Object.values(results).filter(r => r.text === null).length;
  const active = need && todo.length > 0; // else there is nothing to translate: show the document untouched
  // The document as pieces, each translated or (until it arrives, or if it failed) as written. A piece keeps its
  // string while the others change, so the page re-renders only the piece that just arrived. Null = untouched.
  const units = useMemo(
    () => (active ? parts.map((p, i) => results[i]?.text ?? p.original) : null),
    [active, parts, results],
  );

  let status: TranslationStatus = 'off';
  if (active) {
    status = finished < todo.length ? 'translating' : failed === 0 ? 'done' : failed === todo.length ? 'failed' : 'partial';
  }
  const retry = useCallback(() => setAttempt(a => a + 1), []);

  return { status, units, finished, total: todo.length, failed, waiting: waiting > 0, retry };
}
