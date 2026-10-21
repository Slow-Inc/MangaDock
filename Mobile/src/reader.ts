import type { Chapter } from "./catalog.ts";
import { ApiError, createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
import type { ViewerState } from "./viewer.ts";

export type ReaderState = {
  status: "closed" | "ready" | "captchaRequired" | "unlockRequired";
  chapter: Chapter | null;
  mangaId: string | null;
  pages: string[];
  derivative?: "hd" | "saver";
  position?: ViewerState;
};
type Captcha = {
  url: string;
  randomState(): string;
  now?(): number;
  open(url: string, redirect: string): Promise<{ type: string; url?: string }>;
};
export function createReader(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  captcha?: Captcha;
  session?: ReturnType<typeof createMobileSession>;
}) {
  let state: ReaderState = {
    status: "closed",
    chapter: null,
    mangaId: null,
    pages: [],
  };
  const api = createApi(options);
  let clearance: string | null = null;
  let preferences: Omit<ViewerState, "pageIndex"> | null = null;
  let generation = 0;
  let unlocking: Promise<void> | null = null;
  let sources: { hd: string[]; saver: string[] } = { hd: [], saver: [] };
  const listeners = new Set<() => void>();
  const publish = (next: ReaderState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function open(
    mangaId: string,
    chapter: Chapter,
    position?: ViewerState,
  ) {
    const previous =
      state.mangaId === mangaId && state.chapter?.id === chapter.id
        ? state
        : null;
    const restored = position
      ? { position }
      : previous?.position
        ? { position: previous.position }
        : preferences
          ? { position: { ...preferences, pageIndex: 0 } }
          : {};
    const current = ++generation;
    try {
      if (chapter.id.startsWith("ver:")) {
        const version = await api.json<{ pages: string[]; priceCoins: number }>(
          `versions/${encodeURIComponent(chapter.id.slice(4))}`,
        );
        if (version.priceCoins > 0) {
          let unlocked = false;
          if (options.session?.snapshot().status === "signedIn") {
            const token = await options.session.accessToken();
            const result = await api.json<{ unlocked: boolean }>(
              `unlock/check/${encodeURIComponent(chapter.id.slice(4))}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            unlocked = result.unlocked;
          }
          if (!unlocked) {
            if (current === generation)
              publish({
                status: "unlockRequired",
                chapter: { ...chapter, priceCoins: version.priceCoins },
                mangaId,
                pages: [],
                ...restored,
              });
            return;
          }
        }
        if (current === generation) {
          if (version.pages.length === 0)
            throw new Error("ตอนนี้ยังไม่มีหน้าที่พร้อมอ่าน กรุณาเลือกตอนอื่น");
          sources = { hd: version.pages, saver: [] };
          publish({
            status: "ready",
            chapter,
            mangaId,
            pages: version.pages,
            derivative: "hd",
            ...restored,
          });
        }
        return;
      }
      const response = await api.json<{
        pages: string[];
        dataSaverPages?: string[];
        localPages?: (string | null)[];
        localDataSaverPages?: (string | null)[];
      }>(
        `books/chapters/${encodeURIComponent(chapter.id)}/pages?mangaId=${encodeURIComponent(mangaId)}`,
        { headers: clearance ? { "x-captcha-clearance": clearance } : {} },
      );
      if (current === generation) {
        if (response.pages.length === 0)
          throw new Error("ตอนนี้ยังไม่มีหน้าที่พร้อมอ่าน กรุณาเลือกตอนอื่น");
        sources = {
          hd: response.pages.map(
            (url, index) => response.localPages?.[index] || url,
          ),
          saver: (response.dataSaverPages ?? []).map(
            (url, index) => response.localDataSaverPages?.[index] || url,
          ),
        };
        const derivative =
          previous?.derivative === "saver" &&
          sources.saver.length === sources.hd.length
            ? "saver"
            : "hd";
        publish({
          status: "ready",
          chapter,
          mangaId,
          pages: sources[derivative],
          derivative,
          ...restored,
        });
      }
    } catch (error) {
      if (current !== generation) return;
      if (error instanceof ApiError && error.status === 401) {
        clearance = null;
        publish({
          status: "captchaRequired",
          chapter,
          mangaId,
          pages: [],
          ...restored,
          ...(previous?.derivative ? { derivative: previous.derivative } : {}),
        });
      } else throw error;
    }
  }
  return {
    snapshot: () => state,
    open,
    clearanceToken: () => clearance,
    setPosition(position: ViewerState) {
      if (state.status !== "closed") {
        preferences = {
          mode: position.mode,
          direction: position.direction,
          zoom: position.zoom,
        };
        publish({ ...state, position });
      }
    },
    requireCaptcha() {
      if (!state.chapter || !state.mangaId) return;
      generation++;
      clearance = null;
      publish({ ...state, status: "captchaRequired", pages: [] });
    },
    setDerivative(derivative: "hd" | "saver") {
      if (state.status === "captchaRequired") {
        publish({ ...state, derivative });
        return;
      }
      if (state.status !== "ready") return;
      if (derivative === "saver" && sources.saver.length !== sources.hd.length)
        throw new Error("ตอนนี้ยังไม่มีภาพแบบประหยัดข้อมูล");
      if (state.derivative !== derivative)
        publish({ ...state, derivative, pages: sources[derivative] });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      generation++;
      publish({ status: "closed", chapter: null, mangaId: null, pages: [] });
    },
    unlock(): Promise<void> {
      if (unlocking) return unlocking;
      unlocking = (async () => {
        if (
          state.status !== "unlockRequired" ||
          !state.chapter ||
          !state.mangaId
        )
          throw new Error("ไม่มีตอนที่รอปลดล็อก");
        if (!options.session) throw new Error("กรุณาเข้าสู่ระบบก่อนปลดล็อก");
        const current = generation;
        const chapter = state.chapter;
        const mangaId = state.mangaId;
        const token = await options.session.accessToken();
        if (current !== generation) return;
        await api.json(`unlock/${encodeURIComponent(chapter.id.slice(4))}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (current === generation) await open(mangaId, chapter);
      })().finally(() => {
        unlocking = null;
      });
      return unlocking;
    },
    async verifyCaptcha() {
      if (
        state.status !== "captchaRequired" ||
        !state.chapter ||
        !state.mangaId
      )
        throw new Error("ไม่มีคำขอยืนยัน captcha");
      const captcha = options.captcha;
      if (!captcha?.url)
        throw new Error("ยังไม่สามารถเปิดหน้าตรวจสอบได้ กรุณาลองใหม่ภายหลัง");
      const chapter = state.chapter;
      const mangaId = state.mangaId;
      const current = ++generation;
      const url = new URL(captcha.url);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("หน้าตรวจสอบต้องใช้ HTTPS");
      const nonce = captcha.randomState();
      const now = captcha.now ?? Date.now;
      const expiresAt = now() + 300000;
      url.searchParams.set("state", nonce);
      const redirect = "mangadock://captcha/callback";
      const result = await captcha.open(url.toString(), redirect);
      if (result.type !== "success" || !result.url || current !== generation)
        return;
      if (now() >= expiresAt)
        throw new Error("คำขอ captcha หมดอายุ กรุณาลองอีกครั้ง");
      const callback = new URL(result.url);
      const expected = new URL(redirect);
      if (
        callback.protocol !== expected.protocol ||
        callback.host !== expected.host ||
        callback.pathname !== expected.pathname ||
        callback.username ||
        callback.password
      )
        throw new Error("Captcha callback ไม่ตรงกับคำขอ");
      if (callback.searchParams.get("state") !== nonce)
        throw new Error("ผล captcha ไม่ตรงกับคำขอปัจจุบัน");
      const token = callback.searchParams.get("token");
      if (!token) throw new Error("ไม่ได้รับผลการตรวจสอบ");
      const response = await api.json<{ clearanceToken: string }>(
        "books/verify-captcha",
        { method: "POST", body: JSON.stringify({ token }) },
      );
      if (current !== generation) return;
      if (!response.clearanceToken)
        throw new Error("ตรวจสอบไม่สำเร็จ กรุณาลองอีกครั้ง");
      clearance = response.clearanceToken;
      await open(mangaId, chapter);
    },
  };
}
