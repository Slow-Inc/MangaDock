'use client';

import React from 'react';
import { useLang } from './lang-context';

// ─── Shared primitives ──────────────────────────────────────────────────────

type Color = 'indigo' | 'amber' | 'emerald' | 'sky' | 'neutral';

const colorMap: Record<Color, { border: string; bg: string; text: string; dot: string; badge: string }> = {
  indigo:  { border: 'border-indigo-500/35',  bg: 'bg-indigo-500/[0.07]',   text: 'text-indigo-300',  dot: 'bg-indigo-400',  badge: 'bg-indigo-500/20 text-indigo-300' },
  amber:   { border: 'border-amber-500/35',   bg: 'bg-amber-500/[0.07]',    text: 'text-amber-300',   dot: 'bg-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  emerald: { border: 'border-emerald-500/35', bg: 'bg-emerald-500/[0.07]',  text: 'text-emerald-300', dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  sky:     { border: 'border-sky-500/35',     bg: 'bg-sky-500/[0.07]',      text: 'text-sky-300',     dot: 'bg-sky-400',     badge: 'bg-sky-500/20 text-sky-300' },
  neutral: { border: 'border-white/[0.12]',   bg: 'bg-white/[0.04]',        text: 'text-white/60',    dot: 'bg-white/30',    badge: 'bg-white/10 text-white/50' },
};

function Box({ label, sub, color = 'neutral', size = 'md' }: { label: string; sub?: string; color?: Color; size?: 'sm' | 'md' | 'lg' }) {
  const c = colorMap[color];
  const pad = size === 'sm' ? 'px-3 py-2' : size === 'lg' ? 'px-5 py-4' : 'px-4 py-3';
  const fs = size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-[15px]' : 'text-[13px]';
  return (
    <div className={`${pad} rounded-lg border ${c.border} ${c.bg} text-center shrink-0`}>
      <div className={`${fs} font-semibold ${c.text}`}>{label}</div>
      {sub && <div className="text-[11px] text-white/35 mt-0.5">{sub}</div>}
    </div>
  );
}

function Arrow({ dir = 'down', label }: { dir?: 'down' | 'right'; label?: string }) {
  if (dir === 'right') return (
    <div className="flex items-center gap-1 shrink-0">
      {label && <span className="text-[10px] text-white/25 font-mono">{label}</span>}
      <span className="text-white/25 text-[18px] leading-none">→</span>
    </div>
  );
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="w-px h-4 bg-white/15" />
      {label && <span className="text-[10px] text-white/25 font-mono px-1">{label}</span>}
      <span className="text-white/25 text-[14px] leading-none">▾</span>
    </div>
  );
}

function SectionTitle({ color, title, sub }: { color: Color; title: string; sub: string }) {
  const c = colorMap[color];
  return (
    <div className="flex items-start gap-3 mb-6">
      <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${c.dot}`} aria-hidden="true" />
      <div>
        <h2 className="text-[20px] font-semibold text-[#1d1d1f]">{title}</h2>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function Pill({ label, color = 'neutral' }: { label: string; color?: Color }) {
  const c = colorMap[color];
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${c.badge}`}>{label}</span>;
}

function InfoRow({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-black/[0.06] last:border-0">
      <span className="text-[12px] font-mono text-[#6e6e73] shrink-0 min-w-[140px]">{term}</span>
      <span className="text-[13px] text-[#374151] leading-snug">{desc}</span>
    </div>
  );
}

// ─── Diagrams ───────────────────────────────────────────────────────────────

function TopLevelDiagram() {
  const lang = useLang();
  return (
    <div className="my-8 p-6 rounded-2xl bg-[#1c1c1e] border border-white/[0.08]">
      <p className="text-[11px] font-mono text-white/25 mb-6">{lang === 'th' ? 'ภาพรวม Request Flow' : 'Request Flow Overview'}</p>

      {/* Main flow — overflow-x-auto to prevent wrapping */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-2 min-w-max mx-auto justify-center mb-6">
          <Box label="Browser" sub={lang === 'th' ? 'ผู้ใช้' : 'User'} color="neutral" />
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] font-mono text-white/20 mb-0.5">/api/proxy/</span>
            <span className="text-white/25 text-[18px] leading-none">→</span>
          </div>
          <Box label="Frontend" sub="Next.js :4000" color="indigo" />
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] font-mono text-white/20 mb-0.5">HTTP</span>
            <span className="text-white/25 text-[18px] leading-none">→</span>
          </div>
          <Box label="Backend" sub="NestJS :4001" color="amber" />
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] font-mono text-white/20 mb-0.5">HTTP+webhook</span>
            <span className="text-white/25 text-[18px] leading-none">→</span>
          </div>
          <Box label="MIT" sub="Python :5003" color="emerald" />
        </div>
      </div>

      {/* Supporting services */}
      <div className="overflow-x-auto pt-5 border-t border-white/[0.06]">
        <div className="flex items-start justify-center gap-8 min-w-max mx-auto">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-white/20">Auth + Database</span>
            <Box label="Supabase" sub="PostgreSQL + Auth" color="sky" size="sm" />
            <div className="flex items-center gap-2 text-[10px] text-white/20">
              <span className="w-2 h-px bg-white/15" />
              {lang === 'th' ? 'ทุก service ใช้ร่วมกัน' : 'Shared across all services'}
              <span className="w-2 h-px bg-white/15" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-white/20">Cache L2 (source of truth)</span>
            <Box label="Redis" sub="Cache + Pub/Sub" color="amber" size="sm" />
            <div className="text-[10px] text-white/20">Backend ↔ Redis</div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-white/20">GPU Worker (localhost)</span>
            <Box label="Worker" sub="pickle :5004" color="emerald" size="sm" />
            <div className="text-[10px] text-white/20">MIT spawns →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FrontendDiagram() {
  const lang = useLang();
  return (
    <div className="my-6 p-5 rounded-xl bg-[#1c1c1e] border border-indigo-500/20">
      <p className="text-[11px] font-mono text-indigo-400/50 mb-5">Frontend Architecture</p>
      <div className="flex items-start gap-6 flex-wrap">
        {/* Left: flow */}
        <div className="flex flex-col items-center gap-1">
          <Box label="Browser Request" color="neutral" size="sm" />
          <Arrow />
          <Box label="Next.js App Router" color="indigo" />
          <div className="flex gap-4 mt-1">
            <div className="flex flex-col items-center gap-1">
              <Arrow />
              <Box label="Server Component" sub="SSR + data fetch" color="indigo" size="sm" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <Arrow />
              <Box label="/api/proxy/..." sub="→ Backend" color="indigo" size="sm" />
            </div>
          </div>
        </div>

        {/* Right: features */}
        <div className="flex-1 min-w-[200px] space-y-3 pt-1">
          <div className="p-3 rounded-lg bg-indigo-500/[0.06] border border-indigo-500/20">
            <p className="text-[12px] font-semibold text-indigo-300 mb-2">Client Components</p>
            <div className="space-y-1.5">
              <div className="text-[12px] text-white/55">Auth — Supabase JWT (Google, Facebook, Email)</div>
              <div className="text-[12px] text-white/55">LRU Cache — 500 entries, stale-while-revalidate</div>
              <div className="text-[12px] text-white/55">SSE Stream — real-time forum updates</div>
              <div className="text-[12px] text-white/55">Lenis — smooth scroll (disabled on /docs)</div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
            <p className="text-[12px] font-semibold text-white/50 mb-1.5">{lang === 'th' ? 'ทำไมต้องผ่าน /api/proxy/' : 'Why route through /api/proxy/?'}</p>
            <p className="text-[12px] text-white/40 leading-5">{lang === 'th' ? 'Token ไม่ถูกส่งออก network edge, เปลี่ยน backend URL ได้ไม่ต้อง redeploy frontend' : 'Tokens never leave the network edge; backend URL can change without a frontend redeploy.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MITDiagram() {
  const lang = useLang();
  return (
    <div className="my-6 space-y-4">
      {/* Two-process model */}
      <div className="p-5 rounded-xl bg-[#1c1c1e] border border-emerald-500/20">
        <p className="text-[11px] font-mono text-emerald-400/50 mb-5">{lang === 'th' ? 'MIT — Two-Process Model (แยกกันทำงาน)' : 'MIT — Two-Process Model'}</p>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05]">
            <p className="text-[13px] font-semibold text-emerald-300 mb-3">Web Server :5003</p>
            <div className="space-y-1.5 text-[12px] text-white/55">
              <div>{lang === 'th' ? 'รับ HTTP request จาก Backend' : 'Receives HTTP requests from Backend'}</div>
              <div>{lang === 'th' ? 'จัดคิว (Task Queue FIFO)' : 'Queues tasks (FIFO Task Queue)'}</div>
              <div>{lang === 'th' ? 'ส่ง webhook callback + retry' : 'Sends webhook callbacks + retry'}</div>
              <div className="text-white/30 italic">{lang === 'th' ? 'ไม่โหลด ML model ใดเลย' : 'Loads no ML models at all'}</div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-1 text-white/25">
              <div className="text-[10px] font-mono">pickle over</div>
              <div className="w-px h-6 bg-white/20" />
              <div className="text-[10px] font-mono">localhost</div>
              <div className="text-[18px]">⇕</div>
            </div>
          </div>

          <div className="flex-1 p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05]">
            <p className="text-[13px] font-semibold text-emerald-300 mb-3">GPU Worker :5004</p>
            <div className="space-y-1.5 text-[12px] text-white/55">
              <div>{lang === 'th' ? 'รัน ML pipeline ทั้งหมด' : 'Runs the entire ML pipeline'}</div>
              <div>{lang === 'th' ? 'โหลด model ครั้งแรกที่ request' : 'Loads models on first request'}</div>
              <div>{lang === 'th' ? 'bind 127.0.0.1 เท่านั้น (security)' : 'Bound to 127.0.0.1 only (security)'}</div>
              <div className="text-white/30 italic">{lang === 'th' ? 'ไม่รับ request จาก internet' : 'Not reachable from the internet'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="p-5 rounded-xl bg-[#1c1c1e] border border-emerald-500/20">
        <p className="text-[11px] font-mono text-emerald-400/50 mb-5">{lang === 'th' ? 'MIT — Translation Pipeline (ขั้นตอนการแปล)' : 'MIT — Translation Pipeline'}</p>
        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Flow */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Box label="Page Image (PNG/JPG)" color="neutral" size="sm" />
            <Arrow />
            {[
              { step: '1', label: 'Detection', sub: lang === 'th' ? 'หาตำแหน่ง text box' : 'Locate text boxes', color: 'emerald' as Color },
              { step: '2', label: 'OCR', sub: lang === 'th' ? 'อ่านตัวอักษรในภาพ' : 'Read characters from image', color: 'emerald' as Color },
              { step: '3', label: 'Textline Merge', sub: lang === 'th' ? 'รวม region ที่ใกล้กัน' : 'Merge nearby regions', color: 'emerald' as Color },
              { step: '4', label: 'Translation', sub: 'Gemini / Qwen3', color: 'emerald' as Color },
              { step: '5', label: 'Inpainting', sub: lang === 'th' ? 'ลบ text เดิมออก (LaMa)' : 'Erase original text (LaMa)', color: 'emerald' as Color },
              { step: '6', label: 'Rendering', sub: lang === 'th' ? 'วาด text แปลลง' : 'Draw translated text', color: 'emerald' as Color },
            ].map((s, i, arr) => (
              <React.Fragment key={s.step}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-500/50 w-4">{s.step}</span>
                  <Box label={s.label} sub={s.sub} color={s.color} size="sm" />
                </div>
                {i < arr.length - 1 && <Arrow />}
              </React.Fragment>
            ))}
            <Arrow />
            <Box label="Patches (PNG + coordinates)" color="neutral" size="sm" />
            <Arrow label="HMAC webhook" />
            <Box label="Backend → Cache → SSE" color="amber" size="sm" />
          </div>

          {/* Side info */}
          <div className="flex-1 space-y-3 pt-2">
            <div className="p-3 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/20">
              <p className="text-[12px] font-semibold text-emerald-300 mb-2">{lang === 'th' ? 'Patch คืออะไร?' : 'What is a Patch?'}</p>
              <p className="text-[12px] text-white/50 leading-5">
                {lang === 'th'
                  ? 'แทนที่จะ return ทั้งหน้า MIT จะ return PNG เล็กๆ ของแต่ละ text region พร้อม coordinates (xPct, yPct, wPct, hPct) เป็น 0–1 fraction Frontend overlay ทับ original image ทำให้ไม่ต้อง re-download หน้าทั้งหมด'
                  : 'Instead of returning the full page, MIT returns small PNGs for each text region with coordinates (xPct, yPct, wPct, hPct) as 0–1 fractions. Frontend overlays them on the original image, avoiding a full page re-download.'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[12px] font-semibold text-white/50 mb-3">{lang === 'th' ? 'Translators ที่รองรับ' : 'Supported Translators'}</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-mono text-white/25 mb-1.5">TRANSLATOR_TYPE=api</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Pill label="gemini" color="emerald" />
                      <span className="text-[11px] text-white/35">default · gemini-2.5-flash-lite</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill label="deepseek" color="neutral" />
                      <Pill label="groq" color="neutral" />
                      <Pill label="custom_openai" color="neutral" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/[0.06] pt-2">
                  <p className="text-[10px] font-mono text-white/25 mb-1.5">TRANSLATOR_TYPE=local</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Pill label="qwen3" color="emerald" />
                      <span className="text-[11px] text-white/35">default · Qwen3.5-4B</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill label="qwen3_big" color="neutral" />
                      <span className="text-[11px] text-white/25">8B</span>
                      <Pill label="qwen2" color="neutral" />
                      <span className="text-[11px] text-white/25">1.5B</span>
                      <Pill label="qwen2_big" color="neutral" />
                      <span className="text-[11px] text-white/25">7B</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill label="nllb" color="neutral" />
                      <Pill label="sugoi" color="neutral" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MITConfigTable() {
  const lang = useLang();
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-black/[0.08]">
      <table className="w-full text-sm border-collapse">
        <tbody>
          <tr className="bg-[#f5f5f7]">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6e6e73] border-b border-black/[0.08] w-48">Env Variable</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6e6e73] border-b border-black/[0.08]">Default</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6e6e73] border-b border-black/[0.08]">{lang === 'th' ? 'คำอธิบาย' : 'Description'}</th>
          </tr>
          {[
            { env: 'TRANSLATOR_TYPE', def: 'api', desc: lang === 'th' ? 'api = Third-Party API · local = Local LLM บน GPU' : 'api = Third-Party API · local = Local LLM on GPU' },
            { env: 'DEFAULT_API_TRANSLATOR', def: 'gemini', desc: 'api options: gemini | deepseek | groq | custom_openai' },
            { env: 'DEFAULT_LOCAL_TRANSLATOR', def: 'qwen3', desc: 'local options: qwen3 (4B) | qwen3_big (8B) | qwen2 (1.5B) | qwen2_big (7B) | nllb | sugoi' },
            { env: 'GEMINI_MODEL', def: 'gemini-2.5-flash-lite', desc: lang === 'th' ? 'model ที่ใช้เมื่อ DEFAULT_API_TRANSLATOR=gemini' : 'Model used when DEFAULT_API_TRANSLATOR=gemini' },
            { env: 'QWEN3_PRECISION', def: 'bf16', desc: lang === 'th' ? 'ความละเอียด weight ของ Qwen3.5-4B — fp8 | bf16 | fp16 | int8 | int4' : 'Weight precision for Qwen3.5-4B — fp8 | bf16 | fp16 | int8 | int4' },
            { env: 'QWEN3_BIG_PRECISION', def: '(QWEN3_PRECISION)', desc: lang === 'th' ? 'ความละเอียด Qwen3.5-8B; ถ้าไม่ตั้ง จะ inherit จาก QWEN3_PRECISION' : 'Precision for Qwen3.5-8B; inherits from QWEN3_PRECISION if unset' },
            { env: 'PATCH_CONCURRENCY', def: '3', desc: lang === 'th' ? 'กี่ region group ที่ inpaint+render พร้อมกันบน GPU (เพิ่ม = เร็วขึ้น แต่ใช้ VRAM มากขึ้น)' : 'Number of region groups inpainted+rendered concurrently on GPU (higher = faster, more VRAM)' },
            { env: 'MIT_WEBHOOK_MAX_RETRIES', def: '3', desc: lang === 'th' ? 'retry webhook กี่ครั้งก่อน dead-letter (3 retries = 4 attempts รวม)' : 'Webhook retry count before dead-letter (3 retries = 4 attempts total)' },
            { env: 'MIT_WEBHOOK_RETRY_BACKOFF_MS', def: '500', desc: 'base backoff ms — doubles each retry: 500 → 1,000 → 2,000 ms' },
          ].map(({ env, def, desc }, i) => (
            <tr key={env} className={i % 2 === 1 ? 'bg-[#fafafa]' : ''}>
              <td className="px-4 py-2.5 font-mono text-[12px] text-emerald-700 border-b border-black/[0.05]">{env}</td>
              <td className="px-4 py-2.5 font-mono text-[12px] text-[#6e6e73] border-b border-black/[0.05]">{def}</td>
              <td className="px-4 py-2.5 text-[12px] text-[#374151] border-b border-black/[0.05] leading-5">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuantizationExplainer() {
  const lang = useLang();
  const lightCard: Record<string, { border: string; bg: string; text: string }> = {
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50',    text: 'text-emerald-700' },
    neutral: { border: 'border-black/[0.08]', bg: 'bg-[#f5f5f7]',   text: 'text-[#374151]' },
  };
  const levels = [
    { label: 'bf16 / fp16', vram: '~8 GB', note: lang === 'th' ? 'คุณภาพสูงสุด' : 'Best quality', color: 'emerald' },
    { label: 'fp8', vram: '~4 GB', note: lang === 'th' ? 'RTX 40xx เท่านั้น' : 'RTX 40xx only', color: 'emerald' },
    { label: 'int8', vram: '~4 GB', note: lang === 'th' ? 'GPU ทั่วไป' : 'Any GPU', color: 'neutral' },
    { label: 'int4', vram: '~2 GB', note: lang === 'th' ? 'เร็วสุด ประหยัด VRAM' : 'Fastest, lowest VRAM', color: 'neutral' },
  ];
  return (
    <div className="my-4 space-y-3">
      <p className="text-[11px] text-[#6e6e73]">{lang === 'th' ? 'ตัวเลขสำหรับ Qwen3.5-4B (default local model)' : 'Numbers for Qwen3.5-4B (default local model)'}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {levels.map(l => {
          const lc = lightCard[l.color];
          return (
            <div key={l.label} className={`p-3 rounded-lg border ${lc.border} ${lc.bg} text-center`}>
              <div className={`text-[13px] font-mono font-bold ${lc.text}`}>{l.label}</div>
              <div className="text-[11px] text-[#6e6e73] mt-2 space-y-0.5">
                <div>VRAM ≈ {l.vram}</div>
                <div className="text-[10px]">{l.note}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 rounded-lg bg-[#f5f5f7] border border-black/[0.08] text-[12px] text-[#6e6e73] leading-5">
        <span className="text-[#374151]">Qwen2-1.5B</span> (lighter option): bf16 ~3 GB · int4 ~0.8 GB — {lang === 'th' ? 'เหมาะสำหรับ GPU <8 GB หรือต้องการเหลือ VRAM ให้ inpainting' : 'good for GPUs <8 GB or when you need VRAM headroom for inpainting'} ·
        <span className="text-[#374151]"> Qwen3.5-8B</span> (qwen3_big): fp8 ~8 GB
      </div>
    </div>
  );
}

function SupabaseDiagram() {
  const lang = useLang();
  return (
    <div className="my-6 p-5 rounded-xl bg-[#1c1c1e] border border-sky-500/20">
      <p className="text-[11px] font-mono text-sky-400/50 mb-5">{lang === 'th' ? 'Supabase — บทบาทในระบบ' : 'Supabase — Role in the System'}</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-sky-500/25 bg-sky-500/[0.05]">
          <p className="text-[13px] font-semibold text-sky-300 mb-3">Auth Provider</p>
          <div className="space-y-2">
            {['Google OAuth 2.0', 'Facebook OAuth 2.0', 'Email + Password', 'Email Verification'].map(m => (
              <div key={m} className="flex items-center gap-2 text-[12px] text-white/55">
                <span className="w-1 h-1 rounded-full bg-sky-400/50 shrink-0" />
                {m}
              </div>
            ))}
            <div className="mt-3 p-2 rounded-lg bg-white/[0.03] text-[11px] text-white/35 leading-5">
              {lang === 'th' ? 'Frontend ใช้ Supabase client โดยตรง — Backend ตรวจ JWT ผ่าน AuthGuard ทุก request ที่ต้องการ auth' : 'Frontend uses the Supabase client directly — Backend validates JWT via AuthGuard on every authenticated request.'}
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-sky-500/25 bg-sky-500/[0.05]">
          <p className="text-[13px] font-semibold text-sky-300 mb-3">PostgreSQL Database</p>
          <div className="space-y-2">
            {[
              { table: 'manga / chapters / pages', desc: lang === 'th' ? 'คาตาล็อกมังงะ' : 'Manga catalog' },
              { table: 'forum_posts / comments', desc: 'community forum' },
              { table: 'users / profiles', desc: lang === 'th' ? 'ข้อมูลผู้ใช้' : 'User profiles' },
              { table: 'wallets / transactions', desc: lang === 'th' ? 'ระบบเหรียญ' : 'Coin system' },
              { table: 'unlock_records', desc: lang === 'th' ? 'บันทึกการปลดล็อก chapter' : 'Chapter unlock records' },
            ].map(r => (
              <div key={r.table} className="flex items-start gap-2 text-[12px]">
                <code className="text-sky-300/70 shrink-0 text-[11px]">{r.table}</code>
                <span className="text-white/35">— {r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[12px] text-white/45 leading-5">
        {lang === 'th'
          ? <>Supabase เป็น <span className="text-sky-300/80">long-term authority</span> — ข้อมูลจริงสุดท้ายอยู่ที่นี่ ส่วน Redis (L2) เป็น source of truth ณ runtime ที่ Backend flush ขึ้น Supabase แบบ write-behind</>
          : <>Supabase is the <span className="text-sky-300/80">long-term authority</span> — final source of truth for all data. Redis (L2) is the runtime source of truth; Backend flushes it to Supabase asynchronously (write-behind).</>
        }
      </div>
    </div>
  );
}

// ─── Main OverviewView ──────────────────────────────────────────────────────

export default function OverviewView({ onOpenSimulations }: { onOpenSimulations?: () => void }) {
  const lang = useLang();
  return (
    <div className="max-w-[760px]">
      {/* Hero */}
      <div id="ov-hero" className="mb-10">
        <p className="text-[12px] text-[#6e6e73] mb-3">{lang === 'th' ? 'เอกสาร › ภาพรวมระบบ' : 'Docs › System Overview'}</p>
        <h1 className="text-[28px] font-bold text-[#1d1d1f] mb-3 tracking-tight leading-tight">{lang === 'th' ? 'ภาพรวมระบบ MangaDock' : 'MangaDock System Overview'}</h1>
        <p className="text-[15px] text-[#6e6e73] leading-7 max-w-[65ch]">
          {lang === 'th'
            ? 'MangaDock ประกอบด้วย 3 service หลักที่ทำงานร่วมกัน — Frontend รับ request จากผู้ใช้, Backend จัดการ logic และ cache, MIT ประมวลผล AI แปลภาพมังงะ โดยทั้งหมดใช้ Supabase เป็นฐานข้อมูลกลาง'
            : 'MangaDock consists of 3 core services — Frontend handles user requests, Backend manages business logic and caching, MIT runs the AI manga translation pipeline. All services share Supabase as the central database.'}
        </p>
      </div>

      {/* Top-level diagram */}
      <TopLevelDiagram />

      <hr className="border-black/[0.08] my-10" />

      {/* ── Frontend ── */}
      <section id="ov-frontend" className="mb-12">
        <SectionTitle color="indigo" title="Frontend" sub="Next.js 16 + React 19 · port 4000" />
        <p className="text-[15px] text-[#6e6e73] leading-7 mb-4">
          {lang === 'th'
            ? 'Web app ที่ผู้ใช้เห็นโดยตรง ทุก API call ผ่าน proxy route ภายใน Next.js ก่อน ทำให้ token ไม่เดินทางข้าม network edge และสามารถเปลี่ยน backend URL ได้โดยไม่ต้อง redeploy frontend'
            : 'The client-facing web app. Every API call routes through a Next.js proxy first, keeping tokens off the network edge and allowing the backend URL to change without a frontend redeploy.'}
        </p>
        <FrontendDiagram />
        <div className="flex flex-wrap gap-2 mt-4">
          {['Next.js 16 App Router', 'React 19', 'Tailwind CSS', 'Framer Motion', 'Lenis Scroll', 'Supabase SSR'].map(t => (
            <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">{t}</span>
          ))}
        </div>
      </section>

      <hr className="border-black/[0.08] my-10" />

      {/* ── Backend ── */}
      <section id="ov-backend" className="mb-12">
        <SectionTitle color="amber" title="Backend" sub="NestJS 11 · port 4001" />
        <p className="text-[15px] text-[#6e6e73] leading-7 mb-4">
          {lang === 'th'
            ? 'API server กลาง จัดการ logic ทั้งหมด ตั้งแต่ manga catalog, community forum, wallet ไปจนถึงการส่งงานแปลให้ MIT จุดเด่นที่สุดคือระบบ cache 3 ชั้นที่ออกแบบมาเพื่อ horizontal scaling'
            : 'Central API server managing all business logic — manga catalog, community forum, wallet, and dispatching translation jobs to MIT. The standout feature is a 3-layer cache designed for horizontal scaling.'}
        </p>

        <div className="mb-5">
          <p className="text-[14px] font-semibold text-[#1d1d1f] mb-3">{lang === 'th' ? 'Modules หลัก' : 'Core Modules'}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { name: 'books', desc: 'manga catalog, chapter, pages' },
              { name: 'forum', desc: 'posts, comments, votes, SSE' },
              { name: 'upload', desc: 'image upload + MIME validation' },
              { name: 'wallet', desc: 'coin balance + transactions' },
              { name: 'unlock', desc: 'chapter unlock + HWID check' },
              { name: 'cache', desc: 'L1/L2/L3 orchestration, leader' },
            ].map(m => (
              <div key={m.name} className="p-3 rounded-lg bg-[#faf7f0] border border-amber-200">
                <div className="text-[13px] font-mono text-amber-700 font-semibold">{m.name}</div>
                <div className="text-[11px] text-[#6e6e73] mt-0.5">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[14px] font-semibold text-[#1d1d1f] mb-3">{lang === 'th' ? 'ระบบ Cache (Multi-Layer)' : 'Cache System (Multi-Layer)'}</p>
        <p className="text-[13px] text-[#6e6e73] leading-6 mb-2">
          {lang === 'th'
            ? 'แทนที่จะ query Supabase ทุกครั้ง Backend มีชั้น cache 3 ระดับ — ยิ่งชั้นสูง ยิ่งเร็ว ยิ่งชั้นต่ำ ยิ่งคงทน'
            : 'Instead of querying Supabase on every request, Backend has 3 cache layers — higher layers are faster, lower layers are more durable.'}
        </p>
        <div className="my-5 p-4 rounded-xl bg-[#f5f5f7] border border-black/[0.08] flex items-start gap-3">
          <span className="text-[16px] shrink-0 mt-0.5">⚡</span>
          <p className="text-[13px] text-[#374151] leading-6">
            {lang === 'th' ? (
              <><span className="font-medium text-[#1d1d1f]">Cache Simulation</span> ย้ายไปอยู่ที่ tab{' '}
              {onOpenSimulations ? (
                <button onClick={onOpenSimulations} className="text-[#0071e3] hover:underline font-medium">Simulations</button>
              ) : (
                <span className="font-medium text-[#0071e3]">Simulations</span>
              )}{' '}
              แล้ว — รวม 9 scenarios ครบทุก Read / Write / Translation flow พร้อมคำอธิบาย EN+TH และ technical details</>
            ) : (
              <><span className="font-medium text-[#1d1d1f]">Cache Simulation</span> has moved to the{' '}
              {onOpenSimulations ? (
                <button onClick={onOpenSimulations} className="text-[#0071e3] hover:underline font-medium">Simulations</button>
              ) : (
                <span className="font-medium text-[#0071e3]">Simulations</span>
              )}{' '}
              tab — 9 scenarios covering every Read / Write / Translation flow with EN+TH descriptions and technical details.</>
            )}
          </p>
        </div>

        <div className="mt-4 space-y-1">
          <InfoRow term="Leader Election" desc={lang === 'th' ? 'ใช้ Redis NX lock — node ที่ชนะเป็น Leader คนเดียวที่ flush Dirty Queue ไป Supabase ป้องกัน race condition และ double-write' : 'Redis NX lock — the winning node is the sole Leader that flushes the Dirty Queue to Supabase, preventing race conditions and double-writes.'} />
          <InfoRow term="Write-behind" desc={lang === 'th' ? 'เขียน L1+L2 ทันที (sync) แล้วค่อย flush ขึ้น Supabase ทีหลัง (async) ทำให้ response เร็วโดยไม่รอ database' : 'Writes to L1+L2 immediately (sync), then flushes to Supabase later (async) — fast responses without waiting on the database.'} />
          <InfoRow term="Dirty Queue" desc={lang === 'th' ? 'คิวของ key ที่รอ flush — เก็บใน Redis (RPOPLPUSH atomic) มี retry budget + dead-letter สำหรับ key ที่ fail ซ้ำ' : 'Queue of keys awaiting flush — stored in Redis (RPOPLPUSH atomic) with a retry budget + dead-letter for keys that repeatedly fail.'} />
          <InfoRow term="HWID Middleware" desc={lang === 'th' ? 'ทุก request ขอ chapter/upload ต้องมี X-Hardware-Id header — zero-trust asset protection' : 'Every chapter/upload request must include the X-Hardware-Id header — zero-trust asset protection.'} />
        </div>
      </section>

      <hr className="border-black/[0.08] my-10" />

      {/* ── MIT ── */}
      <section id="ov-mit" className="mb-12">
        <SectionTitle color="emerald" title="MIT — Manga Image Translator" sub="Python (FastAPI) · port 5003 + 5004" />
        <p className="text-[15px] text-[#6e6e73] leading-7 mb-4">
          {lang === 'th'
            ? 'Python ML service ที่แปลภาพมังงะ รับ page image แล้วส่งกลับ Patches (PNG เล็กๆ พร้อม coordinates) ซึ่ง Frontend นำไป overlay ทับ original image แทนที่จะส่งทั้งหน้าที่แปลแล้ว ช่วยลด bandwidth และ latency'
            : 'Python ML service that translates manga images. Receives a page image and returns Patches (small PNGs with coordinates) that the Frontend overlays on the original image, rather than sending the full translated page — reducing bandwidth and latency.'}
        </p>
        <MITDiagram />

        <div className="mt-6">
          <p className="text-[14px] font-semibold text-[#1d1d1f] mb-2">{lang === 'th' ? 'Batch Translation Flow (แปลทั้ง Chapter)' : 'Batch Translation Flow'}</p>
          <p className="text-[13px] text-[#6e6e73] leading-6 mb-3">
            {lang === 'th'
              ? 'เมื่อผู้ใช้สั่งแปลทั้ง chapter Backend ส่ง request แบบ fire-and-forget MIT แปลทีละหน้าและส่ง webhook callback กลับมาพร้อม HMAC signature ผู้ใช้รับผลผ่าน SSE แบบ real-time ทีละหน้า'
              : 'When a user requests a full chapter translation, Backend fires a fire-and-forget request to MIT. MIT translates page by page, sending HMAC-signed webhook callbacks. Users receive results via SSE in real time, one page at a time.'}
          </p>
          <div className="flex items-center gap-2 flex-wrap p-4 rounded-xl bg-[#1c1c1e] border border-emerald-500/20">
            <Box label="Backend" sub="fire-and-forget" color="amber" size="sm" />
            <Arrow dir="right" label="POST batch" />
            <Box label="MIT Queue" color="emerald" size="sm" />
            <Arrow dir="right" label="per page" />
            <Box label="HMAC webhook" color="neutral" size="sm" />
            <Arrow dir="right" />
            <Box label="Backend cache" color="amber" size="sm" />
            <Arrow dir="right" label="publish" />
            <Box label="Redis Pub/Sub" color="amber" size="sm" />
            <Arrow dir="right" />
            <Box label="SSE → User" color="indigo" size="sm" />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[14px] font-semibold text-[#1d1d1f] mb-2">{lang === 'th' ? 'Quantization — ปรับ VRAM vs คุณภาพ' : 'Quantization — VRAM vs Quality Trade-off'}</p>
          <p className="text-[13px] text-[#6e6e73] leading-5 mb-3">
            โมเดล ML เก็บ weight ด้วยความละเอียดต่างกัน — ยิ่ง bit น้อย ยิ่งประหยัด VRAM และเร็วขึ้น แต่คุณภาพอาจลดลงเล็กน้อย
          </p>
          <QuantizationExplainer />
        </div>

        <div className="mt-6">
          <p className="text-[14px] font-semibold text-[#1d1d1f] mb-2">Environment Variables หลัก</p>
          <MITConfigTable />
        </div>
      </section>

      <hr className="border-black/[0.08] my-10" />

      {/* ── Supabase ── */}
      <section id="ov-supabase" className="mb-12">
        <SectionTitle color="sky" title="Supabase" sub="PostgreSQL + Auth-as-a-Service" />
        <p className="text-[15px] text-[#6e6e73] leading-7 mb-4">
          ทำหน้าที่ 2 อย่าง: เป็น Auth provider (JWT, OAuth) และ long-term database สำหรับข้อมูลถาวร ขณะที่ Redis เป็น source of truth ณ runtime Supabase คือที่ที่ข้อมูลอยู่จริงๆ ในระยะยาว
        </p>
        <SupabaseDiagram />
      </section>

      <hr className="border-black/[0.08] my-10" />

      {/* Engineering principles */}
      <section id="ov-t4" className="mb-8">
        <h2 className="text-[20px] font-semibold text-[#1d1d1f] mb-4">T4-STANDARD Pillars</h2>
        <p className="text-[13px] text-[#6e6e73] mb-4 leading-6">หลักการวิศวกรรมที่ทีมยึดถือทุก feature</p>
        <div className="space-y-1">
          {[
            { n: '1', name: 'Idempotent Pipelines', desc: 'ทุก operation (Upload, Vote, Unlock) retry-safe ไม่ duplicate แม้รันซ้ำ' },
            { n: '2', name: 'Webhook Integrity', desc: 'ทุก webhook มี HMAC-SHA256 signature ป้องกันการปลอมแปลง' },
            { n: '3', name: 'Multi-Layer Cache', desc: 'L1→L2→L3→Supabase truth hierarchy รองรับ horizontal scaling และ crash recovery' },
            { n: '4', name: 'Worker Memory Contract', desc: 'งาน AI หนักๆ ต้อง delegate ออกจาก HTTP process เสมอ (MIT worker pattern)' },
            { n: '5', name: 'Zero-Trust Assets', desc: 'ทุก chapter image ต้องผ่าน HWID verification + 1-hour window' },
            { n: '6', name: 'Observability', desc: 'ทุก request log structured JSON รวม IP, User-Agent สำหรับ audit trail' },
          ].map(p => (
            <div key={p.n} className="flex gap-4 py-3 border-b border-black/[0.06] last:border-0">
              <span className="text-[12px] font-mono text-[#86868b] w-5 shrink-0 pt-0.5">{p.n}.</span>
              <div>
                <span className="text-[13px] font-medium text-[#1d1d1f]">{p.name}</span>
                <span className="text-[13px] text-[#6e6e73] ml-2">— {p.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
