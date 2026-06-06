'use client';

import React, { useState } from 'react';

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

function SectionTitle({ color, number, title, sub }: { color: Color; number: string; title: string; sub: string }) {
  const c = colorMap[color];
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className={`w-10 h-10 rounded-xl border ${c.border} ${c.bg} flex items-center justify-center shrink-0`}>
        <span className={`text-[13px] font-bold font-mono ${c.text}`}>{number}</span>
      </div>
      <div>
        <h2 className={`text-[20px] font-semibold text-[#f8f9fb]`}>{title}</h2>
        <p className="text-[13px] text-white/40 mt-0.5">{sub}</p>
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
    <div className="flex gap-3 py-2 border-b border-white/[0.06] last:border-0">
      <span className="text-[12px] font-mono text-white/35 shrink-0 min-w-[140px]">{term}</span>
      <span className="text-[13px] text-white/65 leading-snug">{desc}</span>
    </div>
  );
}

// ─── Interactive cache diagram helpers ─────────────────────────────────────

type NS = 'idle' | 'active' | 'ok' | 'err' | 'skip' | 'write';
type ReadScenario      = 'l1hit' | 'l2hit' | 'fullmiss' | 'l2down' | 'l2l3down';
type WriteScenario     = 'leader' | 'leaderfail';
type TranslateScenario = 'txCacheHit' | 'txR2Hit' | 'txMIT';
type CacheScenario     = ReadScenario | WriteScenario | TranslateScenario;
type ReadNode      = 'req' | 'l1' | 'l2' | 'l3' | 'db';
type WriteNode     = 'input' | 'wl1' | 'wl2' | 'dirty' | 'nA' | 'nB' | 'leader' | 'fl3' | 'fdb';
type TranslateNode = 'tfe' | 'tbe' | 'tcfw' | 'tr2' | 'tmit';

interface CacheStep {
  desc: string;
  detail: string;
  read?:      Partial<Record<ReadNode, NS>>;
  write?:     Partial<Record<WriteNode, NS>>;
  translate?: Partial<Record<TranslateNode, NS>>;
}

interface ScenarioDef {
  label: string;
  badge: string;
  group: 'read' | 'write' | 'translate';
  steps: CacheStep[];
}

function nsClass(s: NS): string {
  if (s === 'active') return 'border-amber-400/60 bg-amber-500/[0.12] text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.10)]';
  if (s === 'ok')     return 'border-emerald-400/50 bg-emerald-500/[0.10] text-emerald-200';
  if (s === 'err')    return 'border-red-400/50 bg-red-500/[0.10] text-red-300';
  if (s === 'skip')   return 'border-white/[0.05] bg-transparent text-white/15';
  if (s === 'write')  return 'border-indigo-400/50 bg-indigo-500/[0.10] text-indigo-200';
  return 'border-white/10 bg-white/[0.04] text-white/40';
}

function CNode({ label, sub, state }: { label: string; sub?: string; state: NS }) {
  return (
    <div className={`px-3 py-2 rounded-lg border text-center shrink-0 ${nsClass(state)}`}
      style={{ transition: 'all 0.35s ease' }}>
      <div className="text-[12px] font-semibold leading-tight">{label}</div>
      {sub && <div className="text-[10px] opacity-50 mt-0.5">{sub}</div>}
      <div className="text-[9px] mt-1 h-3 leading-none">
        {state === 'active' && <span className="text-amber-300">● active</span>}
        {state === 'ok'     && <span className="text-emerald-400">✓ ok</span>}
        {state === 'err'    && <span className="text-red-400">✗ fail</span>}
        {state === 'write'  && <span className="text-indigo-300">↑ writing</span>}
        {state === 'skip'   && <span className="text-white/20">— skip</span>}
      </div>
    </div>
  );
}

const cacheScenarios: Record<CacheScenario, ScenarioDef> = {
  // ── Read path scenarios ──────────────────────────────────────────────────
  l1hit: {
    label: 'L1 HIT', badge: '⚡', group: 'read',
    steps: [
      { desc: 'Request เข้ามา', detail: 'Backend รับ request — เริ่มค้นหาจาก L1 ซึ่งเป็น layer เร็วที่สุด (in-process Map)', read: { req: 'active' } },
      { desc: 'ตรวจ L1 Memory', detail: 'ค้นหาใน in-process Map — key นี้ถูก cache ไว้แล้วจาก request ก่อนหน้า', read: { req: 'ok', l1: 'active', l2: 'skip', l3: 'skip', db: 'skip' } },
      { desc: 'L1 HIT — คืนผลทันที', detail: 'พบใน L1 ทันที ไม่ต้องออก process เลย latency < 1μs — L2/L3/Supabase ไม่ถูกเรียกเลย (เส้นทางเร็วที่สุด)', read: { req: 'ok', l1: 'ok', l2: 'skip', l3: 'skip', db: 'skip' } },
    ],
  },
  l2hit: {
    label: 'L2 HIT', badge: '✓', group: 'read',
    steps: [
      { desc: 'Request เข้ามา', detail: 'Backend รับ request — เริ่มค้นหาจาก cache layer บนสุด', read: { req: 'active' } },
      { desc: 'ตรวจ L1 Memory', detail: 'ค้นหาใน in-process Map ก่อน (latency < 1μs)', read: { req: 'ok', l1: 'active' } },
      { desc: 'L1 MISS → ถาม L2 Redis', detail: 'ไม่พบใน L1 → ส่ง GET ไป Redis ซึ่งเป็น source of truth ณ runtime (latency ~1ms)', read: { req: 'ok', l1: 'err', l2: 'active' } },
      { desc: 'L2 HIT — Redis มีข้อมูล', detail: 'พบใน Redis → populate กลับ L1 เพื่อให้ request ถัดไป HIT L1 ทันที ไม่ต้องถาม Redis ซ้ำ', read: { req: 'ok', l1: 'write', l2: 'ok', l3: 'skip', db: 'skip' } },
      { desc: 'เสร็จสิ้น — L1 populate แล้ว', detail: 'Request ถัดไปที่ถาม key เดิมจะ HIT L1 ทันที (ข้าม L2/L3/Supabase ทั้งหมด)', read: { req: 'ok', l1: 'ok', l2: 'ok', l3: 'skip', db: 'skip' } },
    ],
  },
  fullmiss: {
    label: 'Full Miss → DB', badge: '↓', group: 'read',
    steps: [
      { desc: 'Request เข้ามา (cold start / TTL expired)', detail: 'สถานการณ์: ไม่มีข้อมูลใน cache เลย — เช่น server restart ใหม่ หรือ key หมด TTL ทุก layer', read: { req: 'active' } },
      { desc: 'L1 MISS → ถาม L2', detail: 'ไม่พบใน in-process Map — ถามต่อ L2 Redis', read: { req: 'ok', l1: 'err', l2: 'active' } },
      { desc: 'L2 MISS → ถาม L3', detail: 'ไม่พบใน Redis — ถามต่อ L3 Disk', read: { req: 'ok', l1: 'err', l2: 'err', l3: 'active' } },
      { desc: 'L3 MISS → query Supabase', detail: 'ไม่พบใน disk backup เช่นกัน — ต้อง query Supabase โดยตรง (slowest path ~50-200ms)', read: { req: 'ok', l1: 'err', l2: 'err', l3: 'err', db: 'active' } },
      { desc: 'Supabase ตอบกลับ → populate ทุก layer', detail: 'ได้ข้อมูลจาก PostgreSQL → เขียน L1 + L2 + L3 พร้อมกัน เพื่อให้ request ถัดไปเร็วขึ้น (cold start เกิดครั้งเดียว)', read: { req: 'ok', l1: 'write', l2: 'write', l3: 'write', db: 'ok' } },
      { desc: 'เสร็จสิ้น — ทุก layer warm', detail: 'Cache warm แล้ว request ถัดไปจะ HIT L1 ทันที ไม่ต้องย้อนลงไปถึง Supabase อีก', read: { req: 'ok', l1: 'ok', l2: 'ok', l3: 'ok', db: 'ok' } },
    ],
  },
  l2down: {
    label: 'L2 เสียหาย', badge: '🟡', group: 'read',
    steps: [
      { desc: 'Request เข้ามา (Redis ไม่ตอบสนอง)', detail: 'สถานการณ์: Redis เกิด connection timeout หรือ refused — ระบบยังต้องทำงานได้', read: { req: 'active' } },
      { desc: 'L1 MISS → พยายามถาม L2', detail: 'ไม่พบใน L1 → ส่งคำถามไป Redis...', read: { req: 'ok', l1: 'err', l2: 'active' } },
      { desc: 'L2 ERROR — Redis ไม่ตอบ', detail: 'Timeout หรือ connection refused → ระบบ detect failure และ fallback ไป L3 Disk โดยอัตโนมัติ ไม่ throw error ออกไปยัง caller', read: { req: 'ok', l1: 'err', l2: 'err', l3: 'active' } },
      { desc: 'L3 Disk HIT — พบ snapshot', detail: 'พบข้อมูลใน per-node disk backup → populate L1 โดยตรง (ข้าม L2 เพราะยังเสียอยู่)', read: { req: 'ok', l1: 'write', l2: 'err', l3: 'ok', db: 'skip' } },
      { desc: 'คืนผล — ระบบยังทำงานได้', detail: 'Request สำเร็จโดยไม่ต้องรอ Redis ฟื้นตัว Redis recovery จะ repopulate L2 ทีหลังอัตโนมัติ ผู้ใช้ไม่เห็น error', read: { req: 'ok', l1: 'ok', l2: 'err', l3: 'ok', db: 'skip' } },
    ],
  },
  l2l3down: {
    label: 'L2+L3 เสียหาย', badge: '🔴', group: 'read',
    steps: [
      { desc: 'Request เข้ามา (L2+L3 ไม่ตอบสนอง)', detail: 'สถานการณ์วิกฤต: Redis down และ disk unavailable พร้อมกัน — ระบบต้อง serve request ได้ในทุกสถานการณ์', read: { req: 'active' } },
      { desc: 'L1 MISS → พยายามถาม L2', detail: 'ไม่พบใน L1 → ส่งคำถามไป Redis...', read: { req: 'ok', l1: 'err', l2: 'active' } },
      { desc: 'L2 FAIL → fallback ไป L3', detail: 'Redis ไม่ตอบ → ลอง L3 Disk เป็นทางเลือกสุดท้ายใน local node', read: { req: 'ok', l1: 'err', l2: 'err', l3: 'active' } },
      { desc: 'L3 FAIL → last resort: Supabase', detail: 'Disk ก็ไม่ตอบ (IO error / disk full) → ส่ง query ตรงไป Supabase เพื่อรับประกัน availability', read: { req: 'ok', l1: 'err', l2: 'err', l3: 'err', db: 'active' } },
      { desc: 'Supabase ตอบกลับ → populate L1 เท่านั้น', detail: 'ได้ข้อมูลจาก PostgreSQL → เขียนกลับ L1 เท่านั้น (L2+L3 ยังเสีย จะ repopulate ทีหลังเมื่อ recover)', read: { req: 'ok', l1: 'write', l2: 'err', l3: 'err', db: 'ok' } },
      { desc: 'Degraded mode — ระบบยังทำงานได้', detail: 'Request สำเร็จ L3 จะ restore จาก Supabase เมื่อ disk กลับมา L2 จะ repopulate จาก L3 ตามลำดับ', read: { req: 'ok', l1: 'ok', l2: 'err', l3: 'err', db: 'ok' } },
    ],
  },
  // ── Write / leader scenarios ────────────────────────────────────────────
  leader: {
    label: 'Leader Election', badge: '👑', group: 'write',
    steps: [
      { desc: 'set(key, data) ถูกเรียก', detail: 'Backend เรียก cache.set() — ข้อมูลต้องถูกเขียนลง cache และ queue สำหรับ flush ไป Supabase', write: { input: 'active' } },
      { desc: 'เขียน L1 + L2 แบบ synchronous', detail: 'L1 (in-process Map) และ L2 (Redis) ถูก update ทันที ก่อน return ให้ caller — response เร็ว ไม่ต้องรอ database', write: { input: 'ok', wl1: 'write', wl2: 'write' } },
      { desc: 'markDirty(key) → Dirty Queue', detail: 'key ถูก RPUSH เข้า Redis FIFO queue "cache:dirty" — รอ Leader มา flush ไป Supabase ทีหลัง', write: { input: 'ok', wl1: 'ok', wl2: 'ok', dirty: 'active' } },
      { desc: 'ทุก Node แข่ง SET NX lock', detail: 'แต่ละ node รัน: SET cache:leader {nodeId} NX PX 37500 — atomic Redis command, มีแค่ node เดียวที่ชนะได้', write: { input: 'ok', wl1: 'ok', wl2: 'ok', dirty: 'ok', nA: 'active', nB: 'active' } },
      { desc: 'Node A ชนะ — กลายเป็น Leader', detail: 'Node A ได้ SET ก่อน → เป็น Leader, Node B ได้ reply nil (NX fail) → skip flush cycle นี้', write: { input: 'ok', wl1: 'ok', wl2: 'ok', dirty: 'ok', nA: 'ok', nB: 'skip', leader: 'active' } },
      { desc: 'Leader flush → L3 Disk', detail: 'Leader RPOPLPUSH จาก "cache:dirty" → เขียนลง per-node disk backup ทีละ key (atomic pop + write)', write: { input: 'ok', wl1: 'ok', wl2: 'ok', dirty: 'ok', nA: 'ok', nB: 'skip', leader: 'ok', fl3: 'write' } },
      { desc: 'Leader flush → Supabase', detail: 'ข้อมูลถูก persist ลง PostgreSQL (long-term authority) — key ถูกลบออกจาก Dirty Queue อย่างสมบูรณ์', write: { input: 'ok', wl1: 'ok', wl2: 'ok', dirty: 'ok', nA: 'ok', nB: 'skip', leader: 'ok', fl3: 'ok', fdb: 'write' } },
      { desc: 'Leader renew lock ทุก 15 วินาที', detail: 'Lua CAS: IF GET cache:leader == nodeId THEN PEXPIRE 37500 — ถ้า Leader crash → lock expire → node อื่นชนะแทน (automatic failover)', write: { input: 'ok', wl1: 'ok', wl2: 'ok', dirty: 'ok', nA: 'active', nB: 'idle', leader: 'ok', fl3: 'ok', fdb: 'ok' } },
    ],
  },
  leaderfail: {
    label: 'Leader Crash', badge: '💀', group: 'write',
    steps: [
      { desc: 'Leader A กำลัง flush Dirty Queue', detail: 'Leader A ถือ lock และกำลัง flush key ที่ค้างอยู่ไป L3 Disk และ Supabase ตามปกติ', write: { dirty: 'ok', nA: 'ok', leader: 'ok', fl3: 'write' } },
      { desc: 'Leader A crash หรือ network partition', detail: 'Process ตาย / OOM / network cut — Leader A ไม่สามารถ renew lock ได้อีกต่อไป Dirty Queue ยังมี key ที่ค้างอยู่', write: { dirty: 'ok', nA: 'err', leader: 'err', fl3: 'idle' } },
      { desc: 'Lock expire หลัง 37.5 วินาที', detail: 'ไม่มีการ renew (Leader crash) → Redis auto-expire PX 37500ms ผ่านไป lock ว่างลง ไม่มีใครถือ key "cache:leader"', write: { dirty: 'ok', nA: 'err', leader: 'skip' } },
      { desc: 'Node B detect ว่าไม่มี Leader — แข่ง SET NX', detail: 'Node B (surviving nodes) รัน SET cache:leader nodeB NX PX 37500 — ครั้งนี้สำเร็จเพราะ key ว่างแล้ว', write: { dirty: 'ok', nA: 'err', nB: 'active', leader: 'active' } },
      { desc: 'Node B ชนะ — กลายเป็น Leader ใหม่', detail: 'Node B ได้ lock → เริ่ม flush Dirty Queue ที่ค้างไว้จาก Leader A ไม่มีข้อมูลสูญหาย เพราะ FIFO queue ยังอยู่ใน Redis', write: { dirty: 'ok', nA: 'err', nB: 'ok', leader: 'ok' } },
      { desc: 'Leader ใหม่ flush L3 + Supabase', detail: 'Node B flush key ที่ค้างใน Dirty Queue ต่อจาก Leader A ที่ crash ไป — RPOPLPUSH atomic ป้องกัน double-write', write: { dirty: 'ok', nA: 'err', nB: 'ok', leader: 'ok', fl3: 'write', fdb: 'write' } },
      { desc: 'ระบบ recover อัตโนมัติ — ไม่สูญเสียข้อมูล', detail: 'Dirty Queue ถูก flush หมด ทุก key ถูก persist ลง Supabase แม้ Leader เดิม crash ระหว่าง flush write-behind guarantee ยังอยู่', write: { dirty: 'ok', nA: 'err', nB: 'ok', leader: 'ok', fl3: 'ok', fdb: 'ok' } },
    ],
  },

  // ── Translation pipeline scenarios ─────────────────────────────────────
  txCacheHit: {
    label: 'Cache HIT', badge: '⚡', group: 'translate',
    steps: [
      { desc: 'Frontend ขอแปลหน้ามังงะ', detail: 'Frontend ส่ง GET /api/proxy/books/translate?chapter=X&page=Y&lang=THA ไปยัง Backend — key ถูก compute จาก chapterId+pageIndex+lang', translate: { tfe: 'active' } },
      { desc: 'Backend ตรวจ L1 Memory', detail: 'Backend ค้นหา patches ที่ cache ไว้ใน in-process Map (JsonCacheService) — key รูปแบบ translate:{chapterId}:{pageIndex}:{lang}', translate: { tfe: 'ok', tbe: 'active' } },
      { desc: 'L1 HIT — patches พบแล้ว', detail: 'พบ Patch Set ที่ cache ไว้ (x/y/w/h + img_b64 PNG ของทุก text region) → Backend ส่งกลับทันที latency < 1μs ไม่ผ่าน Worker / R2 / MIT เลย', translate: { tfe: 'ok', tbe: 'ok', tcfw: 'skip', tr2: 'skip', tmit: 'skip' } },
      { desc: 'Frontend overlay patches บน original image', detail: 'Frontend ได้รับ patches[] และ overlay PNG แต่ละชิ้นบน original page image ด้วย CSS absolute positioning ตาม xPct/yPct/wPct/hPct ที่ Backend แปลงมาจาก pixel', translate: { tfe: 'ok', tbe: 'ok', tcfw: 'skip', tr2: 'skip', tmit: 'skip' } },
    ],
  },
  txR2Hit: {
    label: 'R2 HIT', badge: '☁', group: 'translate',
    steps: [
      { desc: 'Frontend ขอแปล — Backend cache miss', detail: 'Backend ค้นหาใน L1+L2 Redis → ไม่พบ (cold start หรือ TTL expired) → ต้องตรวจ R2 Storage ว่ามี translated image เก็บไว้แล้วหรือยัง', translate: { tfe: 'ok', tbe: 'err' } },
      { desc: 'Backend เรียก Cloudflare Worker', detail: 'Backend POST ไปยัง Cloudflare Worker endpoint พร้อม deterministic key: translate/{chapterId}/{pageIndex}/{lang}.json — Worker เป็น storage gateway และ cache check point', translate: { tfe: 'ok', tbe: 'active', tcfw: 'active' } },
      { desc: 'Worker ตรวจ R2 Storage', detail: 'Worker ส่ง HEAD/GET request ไปยัง R2 bucket ด้วย key เดียวกัน เพื่อตรวจว่า translated patches ถูก store ไว้แล้ว (Cloudflare R2 เป็น persistent image cache)', translate: { tfe: 'ok', tbe: 'ok', tcfw: 'ok', tr2: 'active', tmit: 'skip' } },
      { desc: 'R2 HIT — Worker ดึง patches กลับ', detail: 'R2 มีไฟล์ → Worker ดึง JSON patches มาส่ง Backend โดยตรง ไม่ต้องรัน MIT (ประหยัด GPU cost)', translate: { tfe: 'ok', tbe: 'ok', tcfw: 'ok', tr2: 'ok', tmit: 'skip' } },
      { desc: 'Backend cache ใน L1+L2 → ส่ง Frontend', detail: 'Backend รับ patches จาก Worker → เก็บลง L1 Memory + L2 Redis (TTL) เพื่อให้ request ถัดไป HIT cache ทันที → ส่ง patches กลับ Frontend', translate: { tfe: 'ok', tbe: 'write', tcfw: 'ok', tr2: 'ok', tmit: 'skip' } },
      { desc: 'Frontend overlay — เสร็จสิ้น', detail: 'Frontend overlay patches บน page image. Request ถัดไปสำหรับหน้าเดิมจะ HIT Backend L1/L2 ทันที ไม่ต้องผ่าน Worker อีก', translate: { tfe: 'ok', tbe: 'ok', tcfw: 'ok', tr2: 'ok', tmit: 'skip' } },
    ],
  },
  txMIT: {
    label: 'MIT Translate', badge: '🤖', group: 'translate',
    steps: [
      { desc: 'Frontend ขอแปล — Backend + R2 ไม่มีข้อมูล', detail: 'Backend cache miss (L1+L2) → เรียก Cloudflare Worker → Worker ตรวจ R2 → R2 ก็ไม่มี translated image (หน้านี้ยังไม่เคยแปล)', translate: { tfe: 'ok', tbe: 'err', tcfw: 'ok', tr2: 'err' } },
      { desc: 'Worker ส่ง image ไป MIT Server', detail: 'Worker ดึง original page image จาก R2 → POST ไปยัง MIT: POST /translate/with-form/patches/batch พร้อม config{target_lang:THA, inpainter:lama_large} + callback_url', translate: { tfe: 'ok', tbe: 'err', tcfw: 'ok', tr2: 'active', tmit: 'active' } },
      { desc: 'MIT รัน translation pipeline', detail: 'Worker Process ใน MIT รัน pipeline: detect text → OCR → translate (Gemini/Qwen3) → inpaint original → render translation → encode PNG patches per text region', translate: { tfe: 'ok', tbe: 'err', tcfw: 'ok', tr2: 'ok', tmit: 'active' } },
      { desc: 'MIT ส่ง webhook ต่อ page กลับ Backend', detail: 'MIT POST webhook callback พร้อม {taskId, pageIndex, imgWidth, imgHeight, patches[], error} ต่อ page — HMAC-SHA256 signed, retry-on-failure, dead-letter ถ้า exhaust retries', translate: { tfe: 'ok', tbe: 'active', tcfw: 'ok', tr2: 'ok', tmit: 'ok' } },
      { desc: 'Backend รับ patches → store ใน R2 ผ่าน Worker', detail: 'Backend เก็บ patches JSON ลง R2 via Worker ด้วย deterministic key เพื่อ serve request ในอนาคตโดยไม่ต้องรัน MIT ซ้ำ (GPU cost saved)', translate: { tfe: 'ok', tbe: 'ok', tcfw: 'write', tr2: 'write', tmit: 'ok' } },
      { desc: 'Backend cache ใน L1+L2 → ส่ง Frontend', detail: 'Backend เก็บ patches ลง L1 Memory + L2 Redis (TTL) → ส่ง Patch Set กลับ Frontend. Next request: L1 HIT ทันที ไม่ผ่าน MIT', translate: { tfe: 'ok', tbe: 'write', tcfw: 'ok', tr2: 'ok', tmit: 'ok' } },
      { desc: 'Frontend overlay — แปลเสร็จสิ้น', detail: 'Frontend ได้รับ patches[] และ overlay PNG แต่ละชิ้นตาม xPct/yPct/wPct/hPct บน original page image ด้วย CSS absolute positioning', translate: { tfe: 'ok', tbe: 'ok', tcfw: 'ok', tr2: 'ok', tmit: 'ok' } },
    ],
  },
};

// ─── Diagrams ───────────────────────────────────────────────────────────────

function TopLevelDiagram() {
  return (
    <div className="my-8 p-6 rounded-2xl bg-[#0c0d12] border border-white/[0.08]">
      <p className="text-[11px] font-mono text-white/25 mb-6">ภาพรวม Request Flow</p>

      {/* Main flow — overflow-x-auto to prevent wrapping */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-2 min-w-max mx-auto justify-center mb-6">
          <Box label="Browser" sub="ผู้ใช้" color="neutral" />
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
              ทุก service ใช้ร่วมกัน
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
  return (
    <div className="my-6 p-5 rounded-xl bg-[#0c0d12] border border-indigo-500/20">
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
            <p className="text-[12px] font-semibold text-white/50 mb-1.5">ทำไมต้องผ่าน /api/proxy/</p>
            <p className="text-[12px] text-white/40 leading-5">Token ไม่ถูกส่งออก network edge, เปลี่ยน backend URL ได้ไม่ต้อง redeploy frontend</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackendCacheDiagram() {
  const [scenario, setScenario] = useState<CacheScenario>('l2hit');
  const [step, setStep] = useState(0);

  const def = cacheScenarios[scenario];
  const steps = def.steps;
  const cur = steps[step];

  const switchScenario = (s: CacheScenario) => { setScenario(s); setStep(0); };
  const prev = () => setStep(p => Math.max(p - 1, 0));
  const next = () => setStep(p => Math.min(p + 1, steps.length - 1));

  const gr = (id: ReadNode):      NS => cur.read?.[id]      ?? 'idle';
  const gw = (id: WriteNode):     NS => cur.write?.[id]     ?? 'idle';
  const gt = (id: TranslateNode): NS => cur.translate?.[id] ?? 'idle';

  const readNodes: { id: ReadNode; label: string; sub: string }[] = [
    { id: 'req', label: 'Request',    sub: 'HTTP' },
    { id: 'l1',  label: 'L1 Memory', sub: 'μs · in-process' },
    { id: 'l2',  label: 'L2 Redis',  sub: 'ms · runtime truth' },
    { id: 'l3',  label: 'L3 Disk',   sub: 'per-node backup' },
    { id: 'db',  label: 'Supabase',  sub: 'long-term authority' },
  ];

  const translateNodes: { id: TranslateNode; label: string; sub: string }[] = [
    { id: 'tfe',  label: 'Frontend',   sub: 'Next.js :4000' },
    { id: 'tbe',  label: 'Backend',    sub: 'L1/L2 cache check' },
    { id: 'tcfw', label: 'CF Worker',  sub: 'storage gateway' },
    { id: 'tr2',  label: 'R2 Storage', sub: 'translated cache' },
    { id: 'tmit', label: 'MIT Server', sub: 'GPU translate' },
  ];

  return (
    <div className="my-6 space-y-3">
      {/* Scenario tabs — grouped by read / write */}
      <div className="space-y-1.5">
        {(['read', 'write', 'translate'] as const).map(group => {
          const ids = (Object.keys(cacheScenarios) as CacheScenario[]).filter(s => cacheScenarios[s].group === group);
          const groupLabel = group === 'read' ? 'Read' : group === 'write' ? 'Write' : 'Translate';
          return (
            <div key={group} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-white/20 shrink-0 w-14">
                {groupLabel}
              </span>
              {ids.map(s => (
                <button
                  key={s}
                  onClick={() => switchScenario(s)}
                  aria-pressed={s === scenario}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                    s === scenario
                      ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                      : 'bg-white/[0.03] border-white/[0.07] text-white/35 hover:text-white/60 hover:border-white/15'
                  }`}
                >
                  {cacheScenarios[s].badge} {cacheScenarios[s].label}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Diagram area */}
      <div className="p-5 rounded-xl bg-[#0c0d12] border border-amber-500/20 min-h-[120px]">

        {/* Read path scenarios (normal + l2down) */}
        {cur.read !== undefined && (
          <div className="overflow-x-auto pb-1">
            <div className="flex items-start gap-2 min-w-max py-2">
              {readNodes.map((n, i) => {
                const nextNode = readNodes[i + 1];
                return (
                  <React.Fragment key={n.id}>
                    <CNode label={n.label} sub={n.sub} state={gr(n.id)} />
                    {nextNode && (
                      <span
                        className="text-xl self-center shrink-0 leading-none"
                        style={{
                          color: gr(nextNode.id) === 'skip' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)',
                          transition: 'color 0.35s ease',
                        }}
                      >→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Write / leader path */}
        {cur.write !== undefined && (
          <div className="space-y-3 py-2">
            {/* Row 1: sync write chain */}
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <CNode label="set(key,data)" state={gw('input')} />
                <span className="text-white/20 text-lg shrink-0">→</span>
                <CNode label="L1 Memory" sub="sync write" state={gw('wl1')} />
                <span className="text-white/15 text-sm shrink-0 px-0.5">+</span>
                <CNode label="L2 Redis" sub="sync write" state={gw('wl2')} />
                <span className="text-white/20 text-lg shrink-0">→</span>
                <CNode label="Dirty Queue" sub="cache:dirty FIFO" state={gw('dirty')} />
              </div>
            </div>
            {/* Down connector */}
            <div className="flex items-center gap-2 pl-2">
              <div className="w-px h-4 bg-white/10" />
              <span className="text-[10px] font-mono text-white/20">Leader เท่านั้น flush ได้</span>
            </div>
            {/* Row 2: nodes compete for lock */}
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <div className="flex gap-1.5">
                  <CNode label="Node A" sub="candidate" state={gw('nA')} />
                  <CNode label="Node B" sub="candidate" state={gw('nB')} />
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[9px] font-mono text-white/20">SET NX</span>
                  <span className="text-white/20 text-lg leading-none">→</span>
                </div>
                <CNode label="Leader ★" sub="SET NX PX 37500" state={gw('leader')} />
              </div>
            </div>
            {/* Down connector */}
            <div className="flex items-center gap-2 pl-2">
              <div className="w-px h-4 bg-white/10" />
              <span className="text-[10px] font-mono text-white/20">async flush</span>
            </div>
            {/* Row 3: flush to persistence */}
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <CNode label="L3 Disk" sub="async flush" state={gw('fl3')} />
                <span className="text-white/20 text-lg shrink-0">→</span>
                <CNode label="Supabase" sub="long-term persist" state={gw('fdb')} />
              </div>
            </div>
          </div>
        )}

        {/* Translate pipeline path */}
        {cur.translate !== undefined && (
          <div className="space-y-2 py-2">
            {/* Main pipeline: Frontend → Backend → CF Worker → R2 → MIT */}
            <div className="overflow-x-auto pb-1">
              <div className="flex items-start gap-2 min-w-max py-1">
                {translateNodes.map((n, i) => {
                  const nextNode = translateNodes[i + 1];
                  return (
                    <React.Fragment key={n.id}>
                      <CNode label={n.label} sub={n.sub} state={gt(n.id)} />
                      {nextNode && (
                        <span
                          className="text-xl self-center shrink-0 leading-none"
                          style={{
                            color: gt(nextNode.id) === 'skip' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)',
                            transition: 'color 0.35s ease',
                          }}
                        >→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            {/* Legend row */}
            <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-white/[0.05]">
              <span className="text-[10px] font-mono text-white/20">path:</span>
              <span className="text-[10px] text-white/25">Frontend → Backend cache → Cloudflare Worker → R2 Storage → MIT Server</span>
            </div>
          </div>
        )}
      </div>

      {/* Step description + navigation */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white/75 mb-1">{cur.desc}</p>
            <p className="text-[12px] text-white/45 leading-5">{cur.detail}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <button onClick={prev} disabled={step === 0} aria-label="ขั้นตอนก่อนหน้า"
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 text-white/35 text-[16px] hover:text-white/60 hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
              ‹
            </button>
            <span className="text-[11px] font-mono text-white/25 w-10 text-center" aria-live="polite">{step + 1} / {steps.length}</span>
            <button onClick={next} disabled={step === steps.length - 1} aria-label="ขั้นตอนถัดไป"
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 text-white/35 text-[16px] hover:text-white/60 hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
              ›
            </button>
          </div>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1.5 mt-3" role="group" aria-label="ขั้นตอน">
          {steps.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              aria-label={`ขั้นตอน ${i + 1}`}
              aria-current={i === step ? 'step' : undefined}
              className={`relative h-[3px] rounded-full transition-all before:absolute before:inset-x-0 before:-inset-y-3 ${i === step ? 'w-5 bg-amber-400/50' : 'w-2 bg-white/10 hover:bg-white/20'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MITDiagram() {
  return (
    <div className="my-6 space-y-4">
      {/* Two-process model */}
      <div className="p-5 rounded-xl bg-[#0c0d12] border border-emerald-500/20">
        <p className="text-[11px] font-mono text-emerald-400/50 mb-5">MIT — Two-Process Model (แยกกันทำงาน)</p>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05]">
            <p className="text-[13px] font-semibold text-emerald-300 mb-3">Web Server :5003</p>
            <div className="space-y-1.5 text-[12px] text-white/55">
              <div>รับ HTTP request จาก Backend</div>
              <div>จัดคิว (Task Queue FIFO)</div>
              <div>ส่ง webhook callback + retry</div>
              <div className="text-white/30 italic">ไม่โหลด ML model ใดเลย</div>
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
              <div>รัน ML pipeline ทั้งหมด</div>
              <div>โหลด model ครั้งแรกที่ request</div>
              <div>bind 127.0.0.1 เท่านั้น (security)</div>
              <div className="text-white/30 italic">ไม่รับ request จาก internet</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="p-5 rounded-xl bg-[#0c0d12] border border-emerald-500/20">
        <p className="text-[11px] font-mono text-emerald-400/50 mb-5">MIT — Translation Pipeline (ขั้นตอนการแปล)</p>
        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Flow */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Box label="Page Image (PNG/JPG)" color="neutral" size="sm" />
            <Arrow />
            {[
              { step: '1', label: 'Detection', sub: 'หาตำแหน่ง text box', color: 'emerald' as Color },
              { step: '2', label: 'OCR', sub: 'อ่านตัวอักษรในภาพ', color: 'emerald' as Color },
              { step: '3', label: 'Textline Merge', sub: 'รวม region ที่ใกล้กัน', color: 'emerald' as Color },
              { step: '4', label: 'Translation', sub: 'Gemini / Qwen3', color: 'emerald' as Color },
              { step: '5', label: 'Inpainting', sub: 'ลบ text เดิมออก (LaMa)', color: 'emerald' as Color },
              { step: '6', label: 'Rendering', sub: 'วาด text แปลลง', color: 'emerald' as Color },
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
              <p className="text-[12px] font-semibold text-emerald-300 mb-2">Patch คืออะไร?</p>
              <p className="text-[12px] text-white/50 leading-5">
                แทนที่จะ return ทั้งหน้า MIT จะ return PNG เล็กๆ ของแต่ละ text region พร้อม coordinates (xPct, yPct, wPct, hPct) เป็น 0–1 fraction
                Frontend overlay ทับ original image ทำให้ไม่ต้อง re-download หน้าทั้งหมด
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[12px] font-semibold text-white/50 mb-3">Translators ที่รองรับ</p>
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
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-white/[0.1]">
      <table className="w-full text-sm border-collapse">
        <tbody>
          <tr className="bg-white/[0.04]">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-white/60 border-b border-white/[0.06] w-48">Env Variable</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-white/60 border-b border-white/[0.06]">Default</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-white/60 border-b border-white/[0.06]">คำอธิบาย</th>
          </tr>
          {[
            { env: 'TRANSLATOR_TYPE', def: 'api', desc: 'api = Third-Party API · local = Local LLM บน GPU' },
            { env: 'DEFAULT_API_TRANSLATOR', def: 'gemini', desc: 'api options: gemini | deepseek | groq | custom_openai' },
            { env: 'DEFAULT_LOCAL_TRANSLATOR', def: 'qwen3', desc: 'local options: qwen3 (4B) | qwen3_big (8B) | qwen2 (1.5B) | qwen2_big (7B) | nllb | sugoi' },
            { env: 'GEMINI_MODEL', def: 'gemini-2.5-flash-lite', desc: 'model ที่ใช้เมื่อ DEFAULT_API_TRANSLATOR=gemini' },
            { env: 'QWEN3_PRECISION', def: 'bf16', desc: 'ความละเอียด weight ของ Qwen3.5-4B — fp8 | bf16 | fp16 | int8 | int4' },
            { env: 'QWEN3_BIG_PRECISION', def: '(QWEN3_PRECISION)', desc: 'ความละเอียด Qwen3.5-8B; ถ้าไม่ตั้ง จะ inherit จาก QWEN3_PRECISION' },
            { env: 'PATCH_CONCURRENCY', def: '3', desc: 'กี่ region group ที่ inpaint+render พร้อมกันบน GPU (เพิ่ม = เร็วขึ้น แต่ใช้ VRAM มากขึ้น)' },
            { env: 'MIT_WEBHOOK_MAX_RETRIES', def: '3', desc: 'retry webhook กี่ครั้งก่อน dead-letter (3 retries = 4 attempts รวม)' },
            { env: 'MIT_WEBHOOK_RETRY_BACKOFF_MS', def: '500', desc: 'base backoff ms — doubles each retry: 500 → 1,000 → 2,000 ms' },
          ].map(({ env, def, desc }, i) => (
            <tr key={env} className={i % 2 === 1 ? 'bg-white/[0.02]' : ''}>
              <td className="px-4 py-2.5 font-mono text-[12px] text-emerald-300/80 border-b border-white/[0.04]">{env}</td>
              <td className="px-4 py-2.5 font-mono text-[12px] text-white/40 border-b border-white/[0.04]">{def}</td>
              <td className="px-4 py-2.5 text-[12px] text-white/60 border-b border-white/[0.04] leading-5">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuantizationExplainer() {
  const levels = [
    { label: 'bf16 / fp16', vram: '~8 GB', note: 'คุณภาพสูงสุด', color: 'emerald' as Color },
    { label: 'fp8', vram: '~4 GB', note: 'RTX 40xx เท่านั้น', color: 'emerald' as Color },
    { label: 'int8', vram: '~4 GB', note: 'GPU ทั่วไป', color: 'neutral' as Color },
    { label: 'int4', vram: '~2 GB', note: 'เร็วสุด ประหยัด VRAM', color: 'neutral' as Color },
  ];
  return (
    <div className="my-4 space-y-3">
      <p className="text-[11px] text-white/30">ตัวเลขสำหรับ Qwen3.5-4B (default local model)</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {levels.map(l => (
          <div key={l.label} className={`p-3 rounded-lg border ${colorMap[l.color].border} ${colorMap[l.color].bg} text-center`}>
            <div className={`text-[13px] font-mono font-bold ${colorMap[l.color].text}`}>{l.label}</div>
            <div className="text-[11px] text-white/30 mt-2 space-y-0.5">
              <div>VRAM ≈ {l.vram}</div>
              <div className="text-[10px]">{l.note}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[12px] text-white/40 leading-5">
        <span className="text-white/55">Qwen2-1.5B</span> (lighter option): bf16 ~3 GB · int4 ~0.8 GB — เหมาะสำหรับ GPU &lt;8 GB หรือต้องการเหลือ VRAM ให้ inpainting ·
        <span className="text-white/55"> Qwen3.5-8B</span> (qwen3_big): fp8 ~8 GB
      </div>
    </div>
  );
}

function SupabaseDiagram() {
  return (
    <div className="my-6 p-5 rounded-xl bg-[#0c0d12] border border-sky-500/20">
      <p className="text-[11px] font-mono text-sky-400/50 mb-5">Supabase — บทบาทในระบบ</p>
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
              Frontend ใช้ Supabase client โดยตรง — Backend ตรวจ JWT ผ่าน AuthGuard ทุก request ที่ต้องการ auth
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-sky-500/25 bg-sky-500/[0.05]">
          <p className="text-[13px] font-semibold text-sky-300 mb-3">PostgreSQL Database</p>
          <div className="space-y-2">
            {[
              { table: 'manga / chapters / pages', desc: 'คาตาล็อกมังงะ' },
              { table: 'forum_posts / comments', desc: 'community forum' },
              { table: 'users / profiles', desc: 'ข้อมูลผู้ใช้' },
              { table: 'wallets / transactions', desc: 'ระบบเหรียญ' },
              { table: 'unlock_records', desc: 'บันทึกการปลดล็อก chapter' },
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
        Supabase เป็น <span className="text-sky-300/80">long-term authority</span> — ข้อมูลจริงสุดท้ายอยู่ที่นี่ ส่วน Redis (L2) เป็น source of truth ณ runtime ที่ Backend flush ขึ้น Supabase แบบ write-behind
      </div>
    </div>
  );
}

// ─── Main OverviewView ──────────────────────────────────────────────────────

export default function OverviewView() {
  return (
    <div className="max-w-[760px]">
      {/* Hero */}
      <div id="ov-hero" className="mb-10">
        <p className="text-[12px] text-white/30 mb-3">เอกสาร &rsaquo; ภาพรวมระบบ</p>
        <h1 className="text-[28px] font-bold text-[#f8f9fb] mb-3 tracking-tight leading-tight">ภาพรวมระบบ MangaDock</h1>
        <p className="text-[15px] text-white/60 leading-7 max-w-[65ch]">
          MangaDock ประกอบด้วย 3 service หลักที่ทำงานร่วมกัน — Frontend รับ request จากผู้ใช้, Backend จัดการ logic และ cache, MIT ประมวลผล AI แปลภาพมังงะ โดยทั้งหมดใช้ Supabase เป็นฐานข้อมูลกลาง
        </p>
      </div>

      {/* Top-level diagram */}
      <TopLevelDiagram />

      <hr className="border-white/[0.07] my-10" />

      {/* ── Frontend ── */}
      <section id="ov-frontend" className="mb-12">
        <SectionTitle color="indigo" number="01" title="Frontend" sub="Next.js 16 + React 19 · port 4000" />
        <p className="text-[15px] text-white/60 leading-7 mb-4">
          Web app ที่ผู้ใช้เห็นโดยตรง ทุก API call ผ่าน proxy route ภายใน Next.js ก่อน ทำให้ token ไม่เดินทางข้าม network edge และสามารถเปลี่ยน backend URL ได้โดยไม่ต้อง redeploy frontend
        </p>
        <FrontendDiagram />
        <div className="flex flex-wrap gap-2 mt-4">
          {['Next.js 16 App Router', 'React 19', 'Tailwind CSS', 'Framer Motion', 'Lenis Scroll', 'Supabase SSR'].map(t => (
            <Pill key={t} label={t} color="indigo" />
          ))}
        </div>
      </section>

      <hr className="border-white/[0.07] my-10" />

      {/* ── Backend ── */}
      <section id="ov-backend" className="mb-12">
        <SectionTitle color="amber" number="02" title="Backend" sub="NestJS 11 · port 4001" />
        <p className="text-[15px] text-white/60 leading-7 mb-4">
          API server กลาง จัดการ logic ทั้งหมด ตั้งแต่ manga catalog, community forum, wallet ไปจนถึงการส่งงานแปลให้ MIT จุดเด่นที่สุดคือระบบ cache 3 ชั้นที่ออกแบบมาเพื่อ horizontal scaling
        </p>

        <div className="mb-5">
          <p className="text-[14px] font-semibold text-white/70 mb-3">Modules หลัก</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { name: 'books', desc: 'manga catalog, chapter, pages' },
              { name: 'forum', desc: 'posts, comments, votes, SSE' },
              { name: 'upload', desc: 'image upload + MIME validation' },
              { name: 'wallet', desc: 'coin balance + transactions' },
              { name: 'unlock', desc: 'chapter unlock + HWID check' },
              { name: 'cache', desc: 'L1/L2/L3 orchestration, leader' },
            ].map(m => (
              <div key={m.name} className="p-3 rounded-lg bg-amber-500/[0.05] border border-amber-500/20">
                <div className="text-[13px] font-mono text-amber-300">{m.name}</div>
                <div className="text-[11px] text-white/35 mt-0.5">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[14px] font-semibold text-white/70 mb-3">ระบบ Cache (Multi-Layer)</p>
        <p className="text-[13px] text-white/50 leading-6 mb-2">
          แทนที่จะ query Supabase ทุกครั้ง Backend มีชั้น cache 3 ระดับ — ยิ่งชั้นสูง ยิ่งเร็ว ยิ่งชั้นต่ำ ยิ่งคงทน
        </p>
        <BackendCacheDiagram />

        <div className="mt-4 space-y-1">
          <InfoRow term="Leader Election" desc="ใช้ Redis NX lock — node ที่ชนะเป็น Leader คนเดียวที่ flush Dirty Queue ไป Supabase ป้องกัน race condition และ double-write" />
          <InfoRow term="Write-behind" desc="เขียน L1+L2 ทันที (sync) แล้วค่อย flush ขึ้น Supabase ทีหลัง (async) ทำให้ response เร็วโดยไม่รอ database" />
          <InfoRow term="Dirty Queue" desc="คิวของ key ที่รอ flush — เก็บใน Redis (RPOPLPUSH atomic) มี retry budget + dead-letter สำหรับ key ที่ fail ซ้ำ" />
          <InfoRow term="HWID Middleware" desc="ทุก request ขอ chapter/upload ต้องมี X-Hardware-Id header — zero-trust asset protection" />
        </div>
      </section>

      <hr className="border-white/[0.07] my-10" />

      {/* ── MIT ── */}
      <section id="ov-mit" className="mb-12">
        <SectionTitle color="emerald" number="03" title="MIT — Manga Image Translator" sub="Python (FastAPI) · port 5003 + 5004" />
        <p className="text-[15px] text-white/60 leading-7 mb-4">
          Python ML service ที่แปลภาพมังงะ รับ page image แล้วส่งกลับ Patches (PNG เล็กๆ พร้อม coordinates) ซึ่ง Frontend นำไป overlay ทับ original image แทนที่จะส่งทั้งหน้าที่แปลแล้ว ช่วยลด bandwidth และ latency
        </p>
        <MITDiagram />

        <div className="mt-6">
          <p className="text-[14px] font-semibold text-white/70 mb-2">Batch Translation Flow (แปลทั้ง Chapter)</p>
          <p className="text-[13px] text-white/50 leading-6 mb-3">
            เมื่อผู้ใช้สั่งแปลทั้ง chapter Backend ส่ง request แบบ fire-and-forget MIT แปลทีละหน้าและส่ง webhook callback กลับมาพร้อม HMAC signature ผู้ใช้รับผลผ่าน SSE แบบ real-time ทีละหน้า
          </p>
          <div className="flex items-center gap-2 flex-wrap p-4 rounded-xl bg-[#0c0d12] border border-emerald-500/20">
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
          <p className="text-[14px] font-semibold text-white/70 mb-2">Quantization — ปรับ VRAM vs คุณภาพ</p>
          <p className="text-[13px] text-white/50 leading-5 mb-3">
            โมเดล ML เก็บ weight ด้วยความละเอียดต่างกัน — ยิ่ง bit น้อย ยิ่งประหยัด VRAM และเร็วขึ้น แต่คุณภาพอาจลดลงเล็กน้อย
          </p>
          <QuantizationExplainer />
        </div>

        <div className="mt-6">
          <p className="text-[14px] font-semibold text-white/70 mb-2">Environment Variables หลัก</p>
          <MITConfigTable />
        </div>
      </section>

      <hr className="border-white/[0.07] my-10" />

      {/* ── Supabase ── */}
      <section id="ov-supabase" className="mb-12">
        <SectionTitle color="sky" number="04" title="Supabase" sub="PostgreSQL + Auth-as-a-Service" />
        <p className="text-[15px] text-white/60 leading-7 mb-4">
          ทำหน้าที่ 2 อย่าง: เป็น Auth provider (JWT, OAuth) และ long-term database สำหรับข้อมูลถาวร ขณะที่ Redis เป็น source of truth ณ runtime Supabase คือที่ที่ข้อมูลอยู่จริงๆ ในระยะยาว
        </p>
        <SupabaseDiagram />
      </section>

      <hr className="border-white/[0.07] my-10" />

      {/* Engineering principles */}
      <section id="ov-t4" className="mb-8">
        <h2 className="text-[20px] font-semibold text-[#f8f9fb] mb-4">T4-STANDARD Pillars</h2>
        <p className="text-[13px] text-white/50 mb-4 leading-6">หลักการวิศวกรรมที่ทีมยึดถือทุก feature</p>
        <div className="space-y-1">
          {[
            { n: '1', name: 'Idempotent Pipelines', desc: 'ทุก operation (Upload, Vote, Unlock) retry-safe ไม่ duplicate แม้รันซ้ำ' },
            { n: '2', name: 'Webhook Integrity', desc: 'ทุก webhook มี HMAC-SHA256 signature ป้องกันการปลอมแปลง' },
            { n: '3', name: 'Multi-Layer Cache', desc: 'L1→L2→L3→Supabase truth hierarchy รองรับ horizontal scaling และ crash recovery' },
            { n: '4', name: 'Worker Memory Contract', desc: 'งาน AI หนักๆ ต้อง delegate ออกจาก HTTP process เสมอ (MIT worker pattern)' },
            { n: '5', name: 'Zero-Trust Assets', desc: 'ทุก chapter image ต้องผ่าน HWID verification + 1-hour window' },
            { n: '6', name: 'Observability', desc: 'ทุก request log structured JSON รวม IP, User-Agent สำหรับ audit trail' },
          ].map(p => (
            <div key={p.n} className="flex gap-4 py-3 border-b border-white/[0.06] last:border-0">
              <span className="text-[12px] font-mono text-white/20 w-5 shrink-0 pt-0.5">{p.n}.</span>
              <div>
                <span className="text-[13px] font-medium text-white/75">{p.name}</span>
                <span className="text-[13px] text-white/40 ml-2">— {p.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
