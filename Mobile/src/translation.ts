import type { createReader } from './reader.ts';
import { ApiError, createApi } from './api.ts';
import { readSse } from './sse.ts';

export type Patch = { xPct: number; yPct: number; wPct: number; hPct: number; url: string };
function validPatches(value: unknown): value is Patch[] {
  return Array.isArray(value) && value.every((patch) => patch && typeof patch.url === 'string' && !!patch.url && ['xPct', 'yPct', 'wPct', 'hPct'].every((key) => typeof patch[key] === 'number' && Number.isFinite(patch[key]) && patch[key] >= 0 && patch[key] <= 100));
}
export type TranslationState = { status: 'idle' | 'running' | 'completed' | 'interrupted' | 'failed'; patches: Record<number, Patch[]>; error: string | null; requestedPages?: number[]; failedPages?: Record<number, string>; stage?: { pageIndex: number; stage: string } };
export function translationProgress(state: TranslationState) {
  const requested = state.requestedPages ?? [];
  const completed = requested.filter(index => state.patches[index] !== undefined).length;
  const failed = requested.filter(index => state.failedPages?.[index] !== undefined).length;
  return { total: requested.length, completed, failed, pending: state.status === 'running' ? requested.length - completed - failed : 0 };
}
export function createTranslation(options: { reader: ReturnType<typeof createReader>; apiOrigin: string; deviceId: string; fetch: typeof globalThis.fetch; deadlineMs?: number; autoConnect?: boolean }) {
  let state: TranslationState = { status: 'idle', patches: {}, error: null };
  const listeners = new Set<() => void>();
  const publish = (next: TranslationState) => { state = next; listeners.forEach((listener) => listener()); };
  const api = createApi(options);
  let foreground = true;
  let generation = 0;
  let job: AbortController | null = null;
  function fail(message: string) {
    const failedPages = { ...state.failedPages };
    for (const index of state.requestedPages ?? [])
      if (state.patches[index] === undefined) failedPages[index] = 'หน้านี้แปลไม่สำเร็จ';
    publish({ ...state, status: 'failed', failedPages, error: message, stage: undefined });
  }
  function deadline(controller: AbortController, current: number) {
    return setTimeout(() => {
      if (current !== generation) return;
      fail('การแปลใช้เวลานานเกินไป กรุณาเริ่มแปลใหม่');
      controller.abort();
    }, options.deadlineMs ?? 16 * 60 * 1000);
  }
  function cancel() {
    if (!job) return;
    generation++; job.abort(); job = null;
    publish({ ...state, status: 'interrupted', error: null });
  }
  const identity = () => { const reading = options.reader.snapshot(); return JSON.stringify([reading.mangaId, reading.chapter?.id, reading.derivative, reading.pages]); };
  let sourceIdentity = identity();
  let targetIdentity = '';
  function configure(targetLang: string, imageModel?: string) {
    const next = JSON.stringify([targetLang, imageModel]);
    if (next !== targetIdentity) { cancel(); targetIdentity = next; publish({ status: 'idle', patches: {}, error: null }); }
  }
  const onReaderChange = () => {
    if (options.reader.snapshot().status !== 'ready') cancel();
    const next = identity();
    if (next !== sourceIdentity) {
      cancel(); sourceIdentity = next;
      publish({ status: state.status === 'interrupted' ? 'interrupted' : 'idle', patches: {}, error: null });
    }
  };
  let disconnect: (() => void) | null = null;
  function activate() { foreground = true; onReaderChange(); if (!disconnect) disconnect = options.reader.subscribe(onReaderChange); }
  function deactivate() { foreground = false; cancel(); disconnect?.(); disconnect = null; }
  if (options.autoConnect !== false) activate();
  return { snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancel,
    activate,
    deactivate,
    configure,
    setForeground(active: boolean) { foreground = active; if (!active) cancel(); },
    async translateChapter(targetLang: string, imageModel?: string) {
      if (!foreground) throw new Error('กรุณากลับเข้าแอปก่อนเริ่มแปล');
      const reading = options.reader.snapshot();
      if (reading.status !== 'ready' || !reading.chapter || !reading.pages.length) throw new Error('กรุณาเปิดตอนที่ต้องการแปล');
      cancel();
      configure(targetLang, imageModel);
      const current = ++generation;
      const controller = new AbortController(); job = controller;
      const timer = deadline(controller, current);
      publish({ status: 'running', patches: {}, requestedPages: reading.pages.map((_, index) => index), failedPages: {}, error: null, stage: undefined });
      const completed = new Set<number>();
      try {
        const response = await api.request(`books/chapters/${encodeURIComponent(reading.chapter.id)}/batch-translate-patches`, {
          method: 'POST', signal: controller.signal, headers: { 'x-captcha-clearance': options.reader.clearanceToken() ?? '', Accept: 'text/event-stream' },
          body: JSON.stringify({ pages: reading.pages.map((pageUrl, pageIndex) => ({ pageIndex, pageUrl })), sourceLang: reading.chapter.translatedLanguage, targetLang, imageModel, derivative: reading.derivative ?? 'hd', mangaId: reading.mangaId }),
        });
        for await (const event of readSse<{ type?: string; pageIndex: number; patches?: Patch[]; error?: string | null; stage?: string }>(response, controller.signal)) {
          if (current !== generation) return;
          if (!Number.isInteger(event.pageIndex) || event.pageIndex < 0 || event.pageIndex >= reading.pages.length) throw new Error('Invalid chapter event');
          if (event.type === 'progress') {
            if (typeof event.stage === 'string') publish({ ...state, stage: { pageIndex: event.pageIndex, stage: event.stage } });
            continue;
          }
          if (completed.has(event.pageIndex) || state.failedPages?.[event.pageIndex]) continue;
          if (event.error) { publish({ ...state, failedPages: { ...state.failedPages, [event.pageIndex]: 'หน้านี้แปลไม่สำเร็จ' } }); continue; }
          if (Array.isArray(event.patches)) {
            if (!validPatches(event.patches)) throw new Error('Invalid Patch geometry');
            completed.add(event.pageIndex);
            publish({ ...state, patches: { ...state.patches, [event.pageIndex]: event.patches } });
          }
        }
        if (current === generation && completed.size !== reading.pages.length) throw new Error('Incomplete chapter stream');
        if (current === generation && !controller.signal.aborted) publish({ ...state, status: 'completed', stage: undefined });
      } catch (error) {
        if (current === generation && error instanceof ApiError && error.status === 401) options.reader.requireCaptcha();
        if (current === generation && !controller.signal.aborted) fail('แปลไม่สำเร็จ กรุณาเริ่มแปลใหม่');
      } finally { clearTimeout(timer); if (current === generation) job = null; }
    },
    async translatePage(pageIndex: number, targetLang: string, imageModel?: string) {
    if (!foreground) throw new Error('กรุณากลับเข้าแอปก่อนเริ่มแปล');
    const reading = options.reader.snapshot();
    if (reading.status !== 'ready' || !reading.chapter || !reading.pages[pageIndex]) throw new Error('กรุณาเปิดหน้าที่ต้องการแปล');
    cancel();
    configure(targetLang, imageModel);
    const current = ++generation;
    const controller = new AbortController(); job = controller;
    const timer = deadline(controller, current);
    const failedPages = { ...state.failedPages };
    delete failedPages[pageIndex];
    const patches = { ...state.patches };
    delete patches[pageIndex];
    publish({ ...state, patches, requestedPages: [pageIndex], failedPages, status: 'running', error: null, stage: undefined });
    try {
      const response = await api.json<{ patches: Patch[] }>(`books/chapters/${encodeURIComponent(reading.chapter.id)}/pages/${pageIndex}/translate-patches`, {
      signal: controller.signal,
      method: 'POST', headers: { 'x-captcha-clearance': options.reader.clearanceToken() ?? '' },
      body: JSON.stringify({ pageUrl: reading.pages[pageIndex], sourceLang: reading.chapter.translatedLanguage, targetLang, imageModel, derivative: reading.derivative ?? 'hd', mangaId: reading.mangaId }),
    });
      if (!validPatches(response.patches)) throw new Error('Invalid translation response');
      if (current === generation && !controller.signal.aborted) publish({ ...state, status: 'completed', patches: { ...state.patches, [pageIndex]: response.patches }, error: null });
    } catch (error) {
      if (current === generation && error instanceof ApiError && error.status === 401) options.reader.requireCaptcha();
      if (current === generation && !controller.signal.aborted) fail('แปลไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally { clearTimeout(timer); if (current === generation) job = null; }
  } };
}
