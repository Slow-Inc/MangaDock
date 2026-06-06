'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';

interface Tech {
  name: string;
  version?: string;
  role: string;
  url: string;
  accent: string; // hex color for the left border / dot
}

interface StackCategory {
  label: string;
  badge: string;       // short badge text
  badgeColor: string;  // tailwind bg class
  dotColor: string;    // tailwind text/bg class for the section dot
  techs: Tech[];
}

const STACK: StackCategory[] = [
  {
    label: 'Frontend',
    badge: 'Next.js App',
    badgeColor: 'bg-indigo-500/15 text-indigo-300',
    dotColor: 'bg-indigo-400',
    techs: [
      {
        name: 'Next.js',
        version: '16.1.6',
        role: 'React framework หลัก — App Router, SSR, catch-all proxy route ไปยัง Backend',
        url: 'https://nextjs.org',
        accent: '#6366f1',
      },
      {
        name: 'React',
        version: '19.2.3',
        role: 'UI library — Concurrent features, Server Components, streaming',
        url: 'https://react.dev',
        accent: '#61DAFB',
      },
      {
        name: 'TypeScript',
        version: '5.9',
        role: 'Static typing ทั้ง Frontend codebase รวมถึง API response types',
        url: 'https://www.typescriptlang.org',
        accent: '#3178C6',
      },
      {
        name: 'Tailwind CSS',
        version: '4',
        role: 'Utility-first CSS framework — ใช้ทุก component ยกเว้น spoiler blur (ใช้ inline style)',
        url: 'https://tailwindcss.com',
        accent: '#06B6D4',
      },
      {
        name: 'Bun',
        version: '1.x',
        role: 'Package manager + JavaScript runtime สำหรับ dev server ฝั่ง Frontend',
        url: 'https://bun.sh',
        accent: '#FBF0DF',
      },
      {
        name: 'Lenis',
        version: '1.3.18',
        role: 'Global smooth scroll — root instance ครอบทั้งแอป, reset scroll ทุก pathname change',
        url: 'https://lenis.darkroom.engineering',
        accent: '#a78bfa',
      },
      {
        name: 'Framer Motion',
        version: '12',
        role: 'Page transitions และ component animations',
        url: 'https://motion.dev',
        accent: '#9333ea',
      },
      {
        name: 'Lucide React',
        version: '1.17',
        role: 'Icon set มาตรฐานของโปรเจกต์ — ใช้ทั้ง UI และ Docs portal นี้',
        url: 'https://lucide.dev',
        accent: '#f97316',
      },
      {
        name: 'Supabase JS',
        version: '2.99',
        role: 'Auth client — Google OAuth, Facebook OAuth, email/password, session management',
        url: 'https://supabase.com/docs/reference/javascript',
        accent: '#3ECF8E',
      },
      {
        name: 'Tesseract.js',
        version: '7',
        role: 'In-browser OCR — ดึง text จากรูปภาพในหน้า reader โดยไม่ต้องส่งขึ้น server',
        url: 'https://tesseract.projectnaptha.com',
        accent: '#f59e0b',
      },
      {
        name: 'shadcn/ui',
        version: '4.10',
        role: 'Headless component primitives — ใช้สำหรับ Dialog, Dropdown, Tooltip',
        url: 'https://ui.shadcn.com',
        accent: '#f8f9fb',
      },
    ],
  },
  {
    label: 'Backend',
    badge: 'NestJS API',
    badgeColor: 'bg-amber-500/15 text-amber-300',
    dotColor: 'bg-amber-400',
    techs: [
      {
        name: 'NestJS',
        version: '11',
        role: 'Node.js framework หลัก — Modules, Guards, Interceptors, SSE streaming',
        url: 'https://nestjs.com',
        accent: '#E0234E',
      },
      {
        name: 'Node.js',
        version: '22',
        role: 'JavaScript runtime สำหรับ Backend',
        url: 'https://nodejs.org',
        accent: '#68A063',
      },
      {
        name: 'TypeScript',
        version: '5.7',
        role: 'Static typing ทั้ง Backend codebase — DTOs, interfaces, service contracts',
        url: 'https://www.typescriptlang.org',
        accent: '#3178C6',
      },
      {
        name: 'Redis (ioredis)',
        version: '5.10',
        role: 'L2 distributed cache + pub/sub channel สำหรับ batch translation fan-out',
        url: 'https://redis.io',
        accent: '#DC382D',
      },
      {
        name: 'RxJS',
        version: '7.8',
        role: 'Reactive streams — ขับ SSE events ฝั่ง Forum และ translation progress',
        url: 'https://rxjs.dev',
        accent: '#B7178C',
      },
      {
        name: 'Supabase JS',
        version: '2.57',
        role: 'Database client + JWT validation สำหรับ AuthGuard',
        url: 'https://supabase.com/docs/reference/javascript',
        accent: '#3ECF8E',
      },
      {
        name: 'Passport.js',
        version: '0.7',
        role: 'OAuth middleware — Google OAuth 2.0 และ Facebook OAuth strategies',
        url: 'https://www.passportjs.org',
        accent: '#34D399',
      },
      {
        name: 'Google Gemini AI',
        version: '0.24',
        role: 'Text chapter translation — translateMangaEpisode() พร้อม context caching',
        url: 'https://ai.google.dev',
        accent: '#4285F4',
      },
      {
        name: 'Jest',
        version: '30',
        role: 'Unit + integration tests — ts-jest, spec files ทุก module',
        url: 'https://jestjs.io',
        accent: '#C21325',
      },
      {
        name: 'LRU Cache',
        version: '11.5',
        role: 'In-memory L1 cache 500 entries — stale-while-revalidate pattern',
        url: 'https://github.com/isaacs/node-lru-cache',
        accent: '#64748b',
      },
    ],
  },
  {
    label: 'MIT — ML Server',
    badge: 'Python GPU',
    badgeColor: 'bg-emerald-500/15 text-emerald-300',
    dotColor: 'bg-emerald-400',
    techs: [
      {
        name: 'FastAPI',
        role: 'Async HTTP server — /translate/with-form/patches, /batch, /cancel endpoints',
        url: 'https://fastapi.tiangolo.com',
        accent: '#009688',
      },
      {
        name: 'Uvicorn',
        role: 'ASGI server (port :5003) — รัน FastAPI ด้วย async I/O',
        url: 'https://www.uvicorn.org',
        accent: '#2dd4bf',
      },
      {
        name: 'PyTorch',
        role: 'Deep learning framework หลัก — inference pipeline ทั้งหมด',
        url: 'https://pytorch.org',
        accent: '#EE4C2C',
      },
      {
        name: 'HuggingFace Transformers',
        role: 'Pre-trained models — OCR, text detection, language models',
        url: 'https://huggingface.co/docs/transformers',
        accent: '#FFD21E',
      },
      {
        name: 'Google Genai',
        role: 'Gemini image translation — OCR + translate manga text ด้วย vision model',
        url: 'https://ai.google.dev/api/python/google/generativeai',
        accent: '#4285F4',
      },
      {
        name: 'Manga OCR',
        role: 'Japanese manga text detection + recognition — specialized model สำหรับ manga',
        url: 'https://github.com/kha-white/manga-ocr',
        accent: '#f472b6',
      },
      {
        name: 'OpenCV',
        role: 'Computer vision — image preprocessing, inpainting, patch extraction',
        url: 'https://opencv.org',
        accent: '#5C3EE8',
      },
      {
        name: 'CTranslate2',
        role: 'Fast CPU/GPU inference engine — ลด latency สำหรับ translation models',
        url: 'https://opennmt.net/CTranslate2',
        accent: '#a78bfa',
      },
      {
        name: 'Pydantic',
        version: '≥2.9.2',
        role: 'Config + payload validation — MIT Pydantic Config อ่าน JSON field จาก Backend',
        url: 'https://docs.pydantic.dev',
        accent: '#e11d48',
      },
      {
        name: 'Pillow',
        role: 'Image I/O และ manipulation — แปลงผล patches เป็น PNG base64',
        url: 'https://python-pillow.org',
        accent: '#f59e0b',
      },
      {
        name: 'httpx',
        version: '0.27.2',
        role: 'Async HTTP client — webhook delivery พร้อม retry + backoff (server/webhook.py)',
        url: 'https://www.python-httpx.org',
        accent: '#6366f1',
      },
      {
        name: 'pythainlp',
        role: 'Thai word segmentation (newmm engine) — ตัดคำสำหรับ Thai line-breaking',
        url: 'https://pythainlp.github.io',
        accent: '#10b981',
      },
    ],
  },
  {
    label: 'Infrastructure',
    badge: 'Cloud',
    badgeColor: 'bg-sky-500/15 text-sky-300',
    dotColor: 'bg-sky-400',
    techs: [
      {
        name: 'Supabase',
        role: 'PostgreSQL database + Row-Level Security + Auth provider (Google, Facebook, email)',
        url: 'https://supabase.com',
        accent: '#3ECF8E',
      },
      {
        name: 'Cloudflare Workers',
        role: 'Edge compute — R2 storage gateway, image proxy, HMAC-signed request routing',
        url: 'https://workers.cloudflare.com',
        accent: '#F48120',
      },
      {
        name: 'Cloudflare R2',
        role: 'Object storage — translated page cache (zero egress), S3-compatible API',
        url: 'https://www.cloudflare.com/products/r2',
        accent: '#F48120',
      },
      {
        name: 'Redis',
        role: 'Shared cache (L2) + pub/sub message bus สำหรับ batch translation fan-out',
        url: 'https://redis.io',
        accent: '#DC382D',
      },
    ],
  },
];

function TechCard({ tech }: { tech: Tech }) {
  return (
    <a
      href={tech.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-2 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14] transition-all duration-200 cursor-pointer"
      style={{ borderLeftColor: tech.accent, borderLeftWidth: '2px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-[rgba(248,249,251,0.9)] group-hover:text-white transition-colors leading-none">
            {tech.name}
          </span>
          {tech.version && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.06] text-white/30 border border-white/[0.06] leading-none">
              {tech.version}
            </span>
          )}
        </div>
        <ExternalLink
          size={12}
          className="text-white/15 group-hover:text-white/40 transition-colors shrink-0 mt-0.5"
        />
      </div>
      <p className="text-[12px] text-white/40 leading-relaxed group-hover:text-white/55 transition-colors">
        {tech.role}
      </p>
    </a>
  );
}

export default function TechStackView() {
  const totalCount = STACK.reduce((s, c) => s + c.techs.length, 0);

  return (
    <div className="space-y-10 pb-12">
      {/* Header */}
      <div className="pb-6 border-b border-white/[0.08]">
        <p className="text-[12px] text-white/30 mb-3">เอกสาร</p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-bold text-[#f8f9fb] tracking-tight leading-tight">
              Tech Stack
            </h1>
            <p className="text-[14px] text-white/40 mt-1.5 leading-relaxed">
              เทคโนโลยีทั้งหมดที่ใช้ใน MangaDock — Frontend · Backend · ML Server · Infrastructure
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-lg text-[12px] font-mono bg-white/[0.04] border border-white/[0.08] text-white/30 shrink-0">
            {totalCount} technologies
          </span>
        </div>
      </div>

      {/* Categories */}
      {STACK.map(cat => (
        <section key={cat.label}>
          {/* Category header */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cat.dotColor}`} />
            <h2 className="text-[15px] font-semibold text-[rgba(248,249,251,0.85)]">
              {cat.label}
            </h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${cat.badgeColor}`}>
              {cat.badge}
            </span>
            <span className="ml-auto text-[11px] font-mono text-white/20">
              {cat.techs.length} libs
            </span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cat.techs.map(tech => (
              <TechCard key={tech.name} tech={tech} />
            ))}
          </div>
        </section>
      ))}

      {/* Footer note */}
      <div className="pt-6 border-t border-white/[0.06]">
        <p className="text-[12px] text-white/20 leading-relaxed">
          Versions แสดง ณ เวลาที่เขียนเอกสาร — ดู{' '}
          <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-white/[0.06] text-indigo-300">
            Frontend/package.json
          </code>
          ,{' '}
          <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-white/[0.06] text-indigo-300">
            Backend/package.json
          </code>
          ,{' '}
          <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-white/[0.06] text-indigo-300">
            MIT/requirements.txt
          </code>{' '}
          สำหรับ versions ล่าสุด
        </p>
      </div>
    </div>
  );
}
