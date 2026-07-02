"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Send, X, MessageSquare } from "lucide-react";
import { routeChat, type ChatTopic } from "@/lib/chat";
import { Markdown } from "@/components/markdown";
import { useLang } from "@/components/lang-provider";
import type { Lang } from "@/lib/i18n";

const ACCENT = "var(--c-ocr)"; // violet — the "AI" identity
const EASE = [0.16, 1, 0.3, 1] as const;

// Mock answers grounded in dashboard data. Production: full dashboard context (all logs + metrics)
// + the routed topic are sent to qwen3.6 · 9arm; the panel renders the streamed reply identically.
const RESPONSES: Record<ChatTopic, { en: string; th: string; sources: string[] }> = {
  pipeline: {
    en: "The MIT pipeline has 5 stages, each with its model + resident VRAM on the 12.3 GB GPU:\n• Detection — AnimeText YOLO · 1.1 GB\n• OCR — manga-ocr + VLM · 2.4 GB\n• Translate — qwen3.6 · 9arm (remote, 0 local VRAM)\n• Inpaint — LaMa · 0.8 GB\n• Render — patch composite (~0)\nPlus CUDA runtime 1.5 GB → 5.8 / 12.3 GB resident (47%), 6.5 GB free. Translate is the one down, but it runs off-box on 9arm — not a VRAM issue.",
    th: "Pipeline ของ MIT มี 5 stage แต่ละตัวมี model + VRAM ที่กินบน GPU 12.3 GB:\n• Detection — AnimeText YOLO · 1.1 GB\n• OCR — manga-ocr + VLM · 2.4 GB\n• Translate — qwen3.6 · 9arm (remote, ไม่กิน local VRAM)\n• Inpaint — LaMa · 0.8 GB\n• Render — patch composite (~0)\nบวก CUDA runtime 1.5 GB → resident 5.8 / 12.3 GB (47%), เหลือ 6.5 GB · ตัวที่ล่มคือ Translate ซึ่งรันนอกเครื่องบน 9arm เลยไม่ใช่ปัญหา VRAM",
    sources: ["VRAM by model", "Pipeline tracer"],
  },
  translate: {
    en: "Translate is failing because the 9arm gateway's data plane is hung — GET /models returns 200 in 0.19s but chat completions to qwen3.6-35b-a3b timed out 3× (40/60/80s). The inference backend is dead, not the gateway. A plain retry will fail; restart the qwen3.6 worker.",
    th: "Translate fail เพราะ data plane ของ 9arm gateway ค้าง — GET /models ขึ้น 200 ใน 0.19s แต่ completion ไป qwen3.6-35b-a3b timeout 3 ครั้ง (40/60/80s) · inference backend ตาย ไม่ใช่ gateway · retry เปล่าๆ จะ fail ให้ restart worker qwen3.6",
    sources: ["MIT log", "Gateway diagnosis", "Translate queue"],
  },
  node: {
    en: "Node be-c0e5f2 is stale: at 16:09:58 its election lease renew failed, then it missed a heartbeat (8.5s) with a Redis RTT spike to 180ms. It's re-syncing L1 from L3 (7,905 entries). Quorum is fine — leader be-7f3a9c is healthy and still draining the dirty queue.",
    th: "Node be-c0e5f2 stale: 16:09:58 election lease renew fail แล้ว missed heartbeat (8.5s) พร้อม Redis RTT พุ่ง 180ms · กำลัง re-sync L1 จาก L3 (7,905 entries) · quorum ยังโอเค — leader be-7f3a9c ปกติและยัง drain dirty queue อยู่",
    sources: ["be-c0e5f2 log", "Cluster", "Cache tiers"],
  },
  oauth: {
    en: "Frontend OAuth (Supabase Auth · Google/Facebook/email) is healthy — 0 auth failures in the last hour across 2.5k requests, 98% Turnstile pass. One token-refresh burst at ~16:02 recovered on its own. No OAuth callback errors in the frontend log.",
    th: "Frontend OAuth (Supabase Auth · Google/Facebook/email) ปกติ — auth fail 0 ใน 1 ชม.ล่าสุด จาก 2.5k request, Turnstile ผ่าน 98% · มี token-refresh burst ช่วง ~16:02 หายเอง · ไม่มี OAuth callback error ใน frontend log",
    sources: ["Frontend log", "Edge security"],
  },
  payment: {
    en: "Payment gateway (Omise) is up — 99.4% success, 184 transactions / ฿42,800 in the last 24h, p95 240ms. No declined-rate spike. Coins: +2.4k topped up / −1.8k spent.",
    th: "Payment gateway (Omise) ปกติ — success 99.4%, 184 transaction / ฿42,800 ใน 24 ชม., p95 240ms · ไม่มี declined พุ่ง · เหรียญ: +2.4k เติม / −1.8k ใช้",
    sources: ["Subsystems", "Economy"],
  },
  backend: {
    en: "Backend is nominal: 28ms p50, Redis + Supabase connected. Cache write-behind is healthy — dirty 7, processing 0, dead-letter 0, last flush 2.4s (SLA 5s). L1/L2/L3 all fresh except node be-c0e5f2 (L1 8.5s old, re-syncing).",
    th: "Backend ปกติ: p50 28ms, Redis + Supabase connected · write-behind healthy — dirty 7, processing 0, dead-letter 0, flush ล่าสุด 2.4s (SLA 5s) · L1/L2/L3 สดหมด ยกเว้น node be-c0e5f2 (L1 เก่า 8.5s กำลัง re-sync)",
    sources: ["Backend log", "Cache tiers", "Write-behind"],
  },
  traffic: {
    en: "Right now: 342 active users (12,847 total). Total bandwidth ↓142 ↑38 Mbps — Frontend 55.6%, Backend 33.3% (node be-7f3a9c is 51.7% of that), MIT 11.1%.",
    th: "ตอนนี้: active user 342 (ทั้งหมด 12,847) · bandwidth รวม ↓142 ↑38 Mbps — Frontend 55.6%, Backend 33.3% (node be-7f3a9c คิดเป็น 51.7%), MIT 11.1%",
    sources: ["Traffic", "Cluster"],
  },
  general: {
    en: "One active incident: MIT translate is down (9arm model hung). Frontend & Backend nominal; node be-c0e5f2 is stale but quorum holds. Ask me about a specific service, node, OAuth, payment, or traffic and I'll pull the relevant logs + metrics.",
    th: "มี incident 1 อย่าง: MIT translate ล่ม (9arm model ค้าง) · Frontend & Backend ปกติ; node be-c0e5f2 stale แต่ quorum ยังอยู่ · ถามเจาะ service / node / OAuth / payment / traffic ได้ เดี๋ยวดึง log + metric ที่เกี่ยวมาให้",
    sources: ["Incident summary", "All logs"],
  },
};

const UI: Record<Lang, { title: string; sub: string; placeholder: string; suggestions: string[] }> = {
  en: {
    title: "Ask the dashboard",
    sub: "reads all logs + metrics",
    placeholder: "Ask about a service, node, log…",
    suggestions: ["Why is translate failing?", "What's wrong with be-c0e5f2?", "Frontend OAuth status?", "Payment gateway ok?"],
  },
  th: {
    title: "ถาม dashboard",
    sub: "อ่าน log + metric ทั้งหมด",
    placeholder: "ถามเรื่อง service, node, log…",
    suggestions: ["ทำไม translate ล่ม?", "be-c0e5f2 เป็นอะไร?", "Frontend OAuth เป็นไง?", "Payment gateway โอเคไหม?"],
  },
};

interface Msg {
  role: "user" | "ai";
  text: string;
  sources?: string[];
}

export function ChatAssistant() {
  const { lang } = useLang();
  const c = UI[lang];
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, thinking]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    const next: Msg[] = [...msgs, { role: "user", text: q }];
    setMsgs(next);
    setInput("");
    setThinking(true);

    // Reply in the language the dev asked in (Thai chars → Thai), else follow the dashboard language.
    const respLang: Lang = /[฀-๿]/.test(q) ? "th" : lang;
    const fallback = () => {
      const r = RESPONSES[routeChat(q)];
      setMsgs((m) => [...m, { role: "ai", text: r[respLang], sources: r.sources }]);
    };

    try {
      const apiMessages = next.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: apiMessages, lang: respLang }) });
      const data = await res.json();
      if (data.reply) setMsgs((m) => [...m, { role: "ai", text: data.reply, sources: ["qwen3.6 · 9arm · live data"] }]);
      else fallback(); // not-configured / gateway error → built-in mock answer
    } catch {
      fallback();
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={c.title}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:-translate-y-0.5"
        style={{ background: ACCENT, color: "#0a0612" }}
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="theme-tx fixed bottom-20 right-5 z-40 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-[var(--radius)]"
            style={{ height: "min(72vh, 560px)", background: "var(--panel)", border: "1px solid var(--panel-hairline)", boxShadow: "var(--shadow-panel)" }}
          >
            {/* header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--panel-hairline)" }}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklch, ${ACCENT} 16%, transparent)` }}>
                  <Sparkles size={13} strokeWidth={2} style={{ color: ACCENT }} />
                </span>
                <div className="leading-tight">
                  <div className="text-[12.5px] font-semibold" style={{ color: "var(--panel-ink)" }}>{c.title}</div>
                  <div className="text-[10px]" style={{ color: "var(--panel-ink-3)" }}>{c.sub} · qwen3.6 · 9arm</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-6 w-6 items-center justify-center rounded-full" style={{ color: "var(--panel-ink-3)" }}><X size={14} /></button>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
              {msgs.length === 0 && (
                <div className="space-y-2">
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--panel-ink-2)" }}>
                    {lang === "th" ? "คุยกับ AI เรื่องอะไรก็ได้จากข้อมูล dashboard — log ราย node, log รวม, OAuth, backend, MIT…" : "Ask about anything from the dashboard's data — per-node logs, combined logs, OAuth, backend, MIT…"}
                  </p>
                  <div className="flex flex-col gap-1.5 pt-1">
                    {c.suggestions.map((s) => (
                      <button key={s} onClick={() => ask(s)} className="rounded-lg px-2.5 py-1.5 text-left text-[11.5px] transition-colors hover:opacity-80" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)", color: "var(--panel-ink-2)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md px-3 py-2 text-[12px]" style={{ background: `color-mix(in oklch, ${ACCENT} 18%, transparent)`, color: "var(--panel-ink)" }}>{m.text}</div>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="max-w-[88%] rounded-2xl rounded-bl-md px-3 py-2 text-[12px] leading-relaxed" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)", color: "var(--panel-ink)" }}>
                      <Markdown text={m.text} />
                    </div>
                    {m.sources && (
                      <div className="flex flex-wrap gap-1 pl-1">
                        {m.sources.map((s) => (
                          <span key={s} className="rounded px-1.5 py-px text-[9.5px]" style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)", color: "var(--panel-ink-3)" }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}

              {thinking && (
                <div className="flex items-center gap-1.5 pl-1">
                  {[0, 1, 2].map((k) => (
                    <motion.span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--panel-ink-3)" }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: k * 0.2 }} />
                  ))}
                </div>
              )}
            </div>

            {/* input */}
            <form
              onSubmit={(e) => { e.preventDefault(); ask(input); }}
              className="flex items-center gap-2 px-3 py-2.5"
              style={{ borderTop: "1px solid var(--panel-hairline)" }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
                className="flex-1 rounded-lg px-3 py-2 text-[12px] outline-none"
                style={{ background: "var(--panel-2)", border: "1px solid var(--panel-hairline)", color: "var(--panel-ink)" }}
              />
              <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity disabled:opacity-40" style={{ background: ACCENT, color: "#0a0612" }}>
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
