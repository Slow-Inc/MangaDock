'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useLang } from './lang-context';

interface Tech {
  name: string;
  version?: string;
  role: string;
  roleEN?: string;
  url: string;
  accent: string;
}

interface StackCategory {
  label: string;
  labelTH: string;
  badge: string;
  badgeClass: string;
  dotClass: string;
  techs: Tech[];
}

const STACK: StackCategory[] = [
  {
    label: 'Frontend',
    labelTH: 'Next.js App Router · port 4000',
    badge: 'Next.js App',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    dotClass: 'bg-indigo-500',
    techs: [
      {
        name: 'Next.js',
        version: '16.1.6',
        role: 'React framework หลัก — App Router, SSR, catch-all proxy route ไปยัง Backend',
        roleEN: 'Main React framework — App Router, SSR, catch-all proxy route to Backend',
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
        roleEN: 'Static typing across the entire Frontend codebase, including API response types',
        url: 'https://www.typescriptlang.org',
        accent: '#3178C6',
      },
      {
        name: 'Tailwind CSS',
        version: '4',
        role: 'Utility-first CSS framework — ใช้ทุก component ยกเว้น spoiler blur (inline style)',
        roleEN: 'Utility-first CSS framework — used across all components except spoiler blur (inline style)',
        url: 'https://tailwindcss.com',
        accent: '#06B6D4',
      },
      {
        name: 'Bun',
        version: '1.x',
        role: 'Package manager + JavaScript runtime สำหรับ dev server ฝั่ง Frontend',
        roleEN: 'Package manager + JavaScript runtime for the Frontend dev server',
        url: 'https://bun.sh',
        accent: '#c17d11',
      },
      {
        name: 'Lenis',
        version: '1.3.18',
        role: 'Global smooth scroll — root instance ครอบทั้งแอป, reset scroll ทุก pathname change',
        roleEN: 'Global smooth scroll — root instance wraps the entire app, resets scroll on every pathname change',
        url: 'https://lenis.darkroom.engineering',
        accent: '#7c3aed',
      },
      {
        name: 'Framer Motion',
        version: '12',
        role: 'Page transitions และ component animations',
        roleEN: 'Page transitions and component animations',
        url: 'https://motion.dev',
        accent: '#9333ea',
      },
      {
        name: 'Lucide React',
        version: '1.17',
        role: 'Icon set มาตรฐานของโปรเจกต์ — ใช้ทั้ง UI และ Docs portal นี้',
        roleEN: 'Standard icon set for the project — used across the UI and this Docs portal',
        url: 'https://lucide.dev',
        accent: '#ea580c',
      },
      {
        name: 'Supabase JS',
        version: '2.99',
        role: 'Auth client — Google OAuth, Facebook OAuth, email/password, session management',
        url: 'https://supabase.com/docs/reference/javascript',
        accent: '#059669',
      },
      {
        name: 'Tesseract.js',
        version: '7',
        role: 'In-browser OCR — ดึง text จากรูปภาพในหน้า reader โดยไม่ต้องส่งขึ้น server',
        roleEN: 'In-browser OCR — extracts text from manga images in the reader without a server round-trip',
        url: 'https://tesseract.projectnaptha.com',
        accent: '#d97706',
      },
      {
        name: 'shadcn/ui',
        version: '4.10',
        role: 'Headless component primitives — ใช้สำหรับ Dialog, Dropdown, Tooltip',
        roleEN: 'Headless component primitives — used for Dialog, Dropdown, Tooltip',
        url: 'https://ui.shadcn.com',
        accent: '#374151',
      },
    ],
  },
  {
    label: 'Backend',
    labelTH: 'NestJS API · port 3001 / 4001',
    badge: 'NestJS API',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
    dotClass: 'bg-amber-500',
    techs: [
      {
        name: 'NestJS',
        version: '11',
        role: 'Node.js framework หลัก — Modules, Guards, Interceptors, SSE streaming',
        roleEN: 'Main Node.js framework — Modules, Guards, Interceptors, SSE streaming',
        url: 'https://nestjs.com',
        accent: '#E0234E',
      },
      {
        name: 'Node.js',
        version: '22',
        role: 'JavaScript runtime สำหรับ Backend',
        roleEN: 'JavaScript runtime for the Backend',
        url: 'https://nodejs.org',
        accent: '#3d8a3e',
      },
      {
        name: 'TypeScript',
        version: '5.7',
        role: 'Static typing ทั้ง Backend codebase — DTOs, interfaces, service contracts',
        roleEN: 'Static typing across the entire Backend codebase — DTOs, interfaces, service contracts',
        url: 'https://www.typescriptlang.org',
        accent: '#3178C6',
      },
      {
        name: 'Redis (ioredis)',
        version: '5.10',
        role: 'L2 distributed cache + pub/sub channel สำหรับ batch translation fan-out',
        roleEN: 'L2 distributed cache + pub/sub channel for batch translation fan-out',
        url: 'https://redis.io',
        accent: '#DC382D',
      },
      {
        name: 'RxJS',
        version: '7.8',
        role: 'Reactive streams — ขับ SSE events ฝั่ง Forum และ translation progress',
        roleEN: 'Reactive streams — drives SSE events for Forum and translation progress',
        url: 'https://rxjs.dev',
        accent: '#B7178C',
      },
      {
        name: 'Supabase JS',
        version: '2.57',
        role: 'Database client + JWT validation สำหรับ AuthGuard',
        roleEN: 'Database client + JWT validation for AuthGuard',
        url: 'https://supabase.com/docs/reference/javascript',
        accent: '#059669',
      },
      {
        name: 'Passport.js',
        version: '0.7',
        role: 'OAuth middleware — Google OAuth 2.0 และ Facebook OAuth strategies',
        roleEN: 'OAuth middleware — Google OAuth 2.0 and Facebook OAuth strategies',
        url: 'https://www.passportjs.org',
        accent: '#059669',
      },
      {
        name: 'Google Gemini AI',
        version: '0.24',
        role: 'Text chapter translation — translateMangaEpisode() พร้อม context caching',
        roleEN: 'Text chapter translation — translateMangaEpisode() with context caching',
        url: 'https://ai.google.dev',
        accent: '#4285F4',
      },
      {
        name: 'Jest',
        version: '30',
        role: 'Unit + integration tests — ts-jest, spec files ทุก module',
        roleEN: 'Unit + integration tests — ts-jest, spec files for every module',
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
    labelTH: 'Python GPU inference · port 5003',
    badge: 'Python GPU',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dotClass: 'bg-emerald-500',
    techs: [
      {
        name: 'FastAPI',
        role: 'Async HTTP server — /translate/with-form/patches, /batch, /cancel endpoints',
        url: 'https://fastapi.tiangolo.com',
        accent: '#009688',
      },
      {
        name: 'Uvicorn',
        role: 'ASGI server (port 5003) — รัน FastAPI ด้วย async I/O',
        roleEN: 'ASGI server (port 5003) — runs FastAPI with async I/O',
        url: 'https://www.uvicorn.org',
        accent: '#0d9488',
      },
      {
        name: 'PyTorch',
        role: 'Deep learning framework หลัก — inference pipeline ทั้งหมด',
        roleEN: 'Main deep learning framework — the entire inference pipeline',
        url: 'https://pytorch.org',
        accent: '#EE4C2C',
      },
      {
        name: 'HuggingFace Transformers',
        role: 'Pre-trained models — OCR, text detection, language models',
        url: 'https://huggingface.co/docs/transformers',
        accent: '#d97706',
      },
      {
        name: 'Google Genai',
        role: 'Gemini image translation — OCR + translate manga text ด้วย vision model',
        roleEN: 'Gemini image translation — OCR + translates manga text using a vision model',
        url: 'https://ai.google.dev/api/python/google/generativeai',
        accent: '#4285F4',
      },
      {
        name: 'Manga OCR',
        role: 'Japanese manga text detection + recognition — specialized model สำหรับ manga',
        roleEN: 'Japanese manga text detection + recognition — specialized model for manga',
        url: 'https://github.com/kha-white/manga-ocr',
        accent: '#db2777',
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
        roleEN: 'Fast CPU/GPU inference engine — reduces latency for translation models',
        url: 'https://opennmt.net/CTranslate2',
        accent: '#7c3aed',
      },
      {
        name: 'Pydantic',
        version: '≥2.9.2',
        role: 'Config + payload validation — MIT Pydantic Config อ่าน JSON field จาก Backend',
        roleEN: 'Config + payload validation — MIT Pydantic Config reads JSON fields from Backend',
        url: 'https://docs.pydantic.dev',
        accent: '#e11d48',
      },
      {
        name: 'Pillow',
        role: 'Image I/O และ manipulation — แปลงผล patches เป็น PNG base64',
        roleEN: 'Image I/O and manipulation — converts result patches to PNG base64',
        url: 'https://python-pillow.org',
        accent: '#d97706',
      },
      {
        name: 'httpx',
        version: '0.27.2',
        role: 'Async HTTP client — webhook delivery พร้อม retry + backoff (server/webhook.py)',
        roleEN: 'Async HTTP client — webhook delivery with retry + backoff (server/webhook.py)',
        url: 'https://www.python-httpx.org',
        accent: '#6366f1',
      },
      {
        name: 'pythainlp',
        role: 'Thai word segmentation (newmm engine) — ตัดคำสำหรับ Thai line-breaking',
        roleEN: 'Thai word segmentation (newmm engine) — tokenization for Thai line-breaking',
        url: 'https://pythainlp.github.io',
        accent: '#059669',
      },
    ],
  },
  {
    label: 'Infrastructure',
    labelTH: 'Cloud · Storage · Database',
    badge: 'Cloud',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
    dotClass: 'bg-sky-500',
    techs: [
      {
        name: 'Supabase',
        role: 'PostgreSQL database + Row-Level Security + Auth provider (Google, Facebook, email)',
        url: 'https://supabase.com',
        accent: '#059669',
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
        roleEN: 'Shared cache (L2) + pub/sub message bus for batch translation fan-out',
        url: 'https://redis.io',
        accent: '#DC382D',
      },
    ],
  },
];

// ─── Stat strip ───────────────────────────────────────────────────────────────


// ─── Tech detail data ─────────────────────────────────────────────────────────

const TECH_DETAILS: Record<string, { what: string; whatEN: string; why: string; whyEN: string }> = {
  'Next.js': {
    what: 'React framework ครบครัน — App Router, Server-Side Rendering, Server Components, built-in image optimization, และ API routes ในที่เดียว',
    whatEN: 'Full-featured React framework — App Router, SSR, Server Components, built-in image optimization, and API routes all in one',
    why: 'ต้องการ SSR สำหรับ SEO ของหน้า manga catalog; catch-all proxy route (/api/proxy/...) ป้องกัน auth token โผล่ที่ client; file-based routing จัดการง่ายในทีม',
    whyEN: 'SSR is needed for manga catalog SEO; the catch-all proxy route (/api/proxy/...) keeps auth tokens off the client; file-based routing is easy to maintain across the team',
  },
  'React': {
    what: 'UI library แบบ declarative สำหรับสร้าง component tree — Concurrent features, Suspense, Server Components, และ use() hook ใน v19',
    whatEN: 'Declarative UI library for building component trees — Concurrent features, Suspense, Server Components, and the use() hook in v19',
    why: 'Foundation ของ Next.js; React 19 Concurrent features ทำให้ streaming render ได้เร็วขึ้น และ Server Components ลด JS bundle ที่ส่งถึง client',
    whyEN: 'Foundation of Next.js; React 19 Concurrent features enable faster streaming renders; Server Components reduce the JS bundle sent to the client',
  },
  'TypeScript': {
    what: 'JavaScript superset ที่เพิ่ม static typing, generics, decorators, และ strict null checks — compile ลงเป็น plain JS',
    whatEN: 'JavaScript superset adding static typing, generics, decorators, and strict null checks — compiles down to plain JS',
    why: 'ทั้ง Frontend และ Backend ใช้ TypeScript ทำให้ share type ระหว่าง API response กับ UI component ได้ตรง ลด runtime error และ catch bug ตั้งแต่ compile time',
    whyEN: 'Both Frontend and Backend use TypeScript, enabling shared types between API responses and UI components — bugs are caught at compile time, not runtime',
  },
  'Tailwind CSS': {
    what: 'Utility-first CSS framework — generate CSS จาก class names โดยตรง ไม่มี runtime overhead, tree-shakes unused styles อัตโนมัติ',
    whatEN: 'Utility-first CSS framework — generates CSS directly from class names, no runtime overhead, auto tree-shakes unused styles',
    why: 'เขียน UI ได้เร็วมากโดยไม่ต้องเขียน CSS แยก; ยกเว้น spoiler blur ที่ใช้ inline style เพราะ --tw-blur CSS variable ไม่ transition ได้อย่างน่าเชื่อถือใน browser',
    whyEN: 'Dramatically faster UI development without separate CSS files; except for spoiler blur which requires inline style since --tw-blur CSS vars don\'t transition reliably across browsers',
  },
  'Bun': {
    what: 'JavaScript runtime + package manager ที่เร็วมาก — native TypeScript/JSX support, built-in test runner, bundler, และ install ไวกว่า npm หลายเท่า',
    whatEN: 'Extremely fast JavaScript runtime and package manager — native TypeScript/JSX support, built-in test runner, bundler, and installs much faster than npm',
    why: 'ใช้กับ Frontend โดยเฉพาะเพื่อให้ dev server start ไวและ install dependency เร็ว; Backend ยังใช้ npm เพราะ NestJS tooling รองรับ npm ดีกว่า',
    whyEN: 'Used specifically for Frontend for fast dev server startup and dependency installs; Backend still uses npm since NestJS tooling has better npm support',
  },
  'Lenis': {
    what: 'Smooth scroll library ที่ override native scroll ด้วย lerp interpolation — ทำให้ scroll รู้สึก buttery smooth บนทุก OS และทุก refresh rate',
    whatEN: 'Smooth scroll library that overrides native scroll with lerp interpolation — buttery-smooth scrolling on all OSes and refresh rates',
    why: 'Native Windows scroll รู้สึก choppy บน high-refresh monitors; root instance ครอบทั้ง app และ call lenis.scrollTo(0, { immediate: true }) ทุก pathname change เพื่อ reset scroll position',
    whyEN: 'Native Windows scroll feels choppy on high-refresh monitors; a root instance wraps the entire app and calls lenis.scrollTo(0, { immediate: true }) on every pathname change to reset scroll position',
  },
  'Framer Motion': {
    what: 'Animation library สำหรับ React — gesture support, layout animations, AnimatePresence สำหรับ exit animations, spring physics, scroll-driven animations',
    whatEN: 'React animation library — gesture support, layout animations, AnimatePresence for exit animations, spring physics, scroll-driven animations',
    why: 'ใช้กับ page transitions ใน Docs portal (AnimatePresence mode="wait") และ component animations ทั่วไป; API ชัดเจนกว่า CSS transitions สำหรับ complex sequences',
    whyEN: 'Powers page transitions in this Docs portal (AnimatePresence mode="wait") and general component animations; cleaner API than CSS transitions for complex sequences',
  },
  'Lucide React': {
    what: 'Open-source icon library กว่า 1,000 ไอคอน SVG — tree-shakable, consistent 2px stroke width, ควบคุมขนาด/สีผ่าน props',
    whatEN: 'Open-source icon library with 1,000+ SVG icons — tree-shakable, consistent 2px stroke width, size and color controlled via props',
    why: 'เลือกเป็น icon set มาตรฐานเพราะ clean minimal style เข้ากับ Apple-inspired design; tree-shaking ทำให้ bundle ไม่โป่ง',
    whyEN: 'Chosen as the standard icon set for its clean minimal style matching the project\'s Apple-inspired design; tree-shaking keeps the bundle lean',
  },
  'Supabase JS': {
    what: 'JavaScript/TypeScript client สำหรับ Supabase — auth session management, OAuth flow, database queries, realtime subscriptions, storage',
    whatEN: 'JavaScript/TypeScript client for Supabase — auth session management, OAuth flows, database queries, realtime subscriptions, and storage',
    why: 'จัดการ OAuth flow (Google, Facebook) และ session token ได้ครบ; AuthContext.tsx ใช้ wrap Supabase user เป็น AppUser; clearAllApiCache() เรียกทุก auth state change เพื่อป้องกัน cross-user cache bleed',
    whyEN: 'Handles OAuth flows (Google, Facebook) and session tokens cleanly; AuthContext.tsx wraps the Supabase user into an AppUser type; clearAllApiCache() is called on every auth state change to prevent cross-user cache bleed',
  },
  'Tesseract.js': {
    what: 'OCR engine ที่รัน in-browser ผ่าน WebAssembly — รองรับหลายภาษา, ไม่ต้องส่ง image ขึ้น server, ทำงานได้แม้ offline',
    whatEN: 'In-browser OCR engine via WebAssembly — multi-language support, no server required, works offline',
    why: 'ให้ user copy text จากหน้า manga ใน reader ได้โดยตรง โดยไม่ต้องรอ server roundtrip หรือเปิดเผย content ของหน้าไปยัง external service',
    whyEN: 'Lets users copy text from manga pages in the reader without a server roundtrip or exposing page content to an external service',
  },
  'shadcn/ui': {
    what: 'Copy-paste component primitives บน Radix UI + Tailwind — ไม่มี runtime package, customize ได้เต็ม, accessibility ครบ (focus trap, keyboard nav)',
    whatEN: 'Copy-paste component primitives built on Radix UI + Tailwind — no runtime package, fully customizable, complete accessibility (focus trap, keyboard nav)',
    why: 'ใช้ Dialog, Dropdown, Tooltip ที่ต้องการ accessibility ที่ถูกต้องโดยไม่เพิ่ม runtime dependency; component อยู่ใน codebase เลยแก้ไขได้อิสระ',
    whyEN: 'Used for Dialog, Dropdown, and Tooltip which need proper accessibility without adding a runtime dependency; components live in the codebase and can be freely modified',
  },
  'NestJS': {
    what: 'Node.js framework แบบ opinionated — decorator-based architecture, Dependency Injection, Modules, Guards, Interceptors, Pipes ทำงานด้วย TypeScript',
    whatEN: 'Opinionated Node.js framework — decorator-based architecture, Dependency Injection, Modules, Guards, Interceptors, Pipes, built with TypeScript',
    why: 'DI system ทำให้ unit test service ได้ง่ายโดย mock dependencies; module system แยก concern ชัดเจน (books/forum/upload/wallet); Guards เหมาะกับ Auth + Turnstile logic',
    whyEN: 'DI system makes unit-testing services easy by mocking dependencies; the module system clearly separates concerns (books/forum/upload/wallet); Guards are a natural fit for Auth + Turnstile logic',
  },
  'Node.js': {
    what: 'JavaScript runtime ฝั่ง server — async I/O event loop, native ESM, Worker Threads, built-in fetch API, และ npm ecosystem',
    whatEN: 'Server-side JavaScript runtime — async I/O event loop, native ESM, Worker Threads, built-in fetch API, and the npm ecosystem',
    why: 'Foundation ของ NestJS; Node 22 LTS มี performance ดีขึ้นและ native fetch ลด dependency; ใช้ภาษาเดียวกัน (TypeScript/JS) ตลอด stack ทำให้สลับ Frontend/Backend ง่าย',
    whyEN: 'Foundation of NestJS; Node 22 LTS has improved performance and native fetch to reduce dependencies; using the same language (TypeScript/JS) across the full stack makes context-switching easy',
  },
  'Redis (ioredis)': {
    what: 'In-memory data store ที่เร็วมาก — pub/sub, sorted sets, TTL, pipelining, Lua scripts, clustering; ioredis คือ high-performance Node.js client',
    whatEN: 'High-speed in-memory data store — pub/sub, sorted sets, TTL, pipelining, Lua scripts, clustering; ioredis is the high-performance Node.js client',
    why: 'ใช้เป็น L2 distributed cache (ลด database round-trip) และ pub/sub bus สำหรับ batch translation fan-out; ioredis ให้ performance ดีที่สุดในบรรดา Node.js Redis clients',
    whyEN: 'Used as the L2 distributed cache (reducing database round-trips) and pub/sub bus for batch translation fan-out; ioredis is the highest-performance Node.js Redis client',
  },
  'RxJS': {
    what: 'Reactive programming library — Observables, operators (map/filter/mergeMap/debounceTime), Subjects สำหรับ multicasting, schedulers',
    whatEN: 'Reactive programming library — Observables, operators (map/filter/mergeMap/debounceTime), Subjects for multicasting, schedulers',
    why: 'NestJS SSE streaming ต้องการ Observable return type โดยตรง; Subject ใช้เป็น in-process event bus ก่อน publish ไปยัง Redis pub/sub; ลด callback hell ในการจัดการ async event streams',
    whyEN: 'NestJS SSE streaming requires Observable return types natively; Subjects serve as an in-process event bus before publishing to Redis pub/sub; eliminates callback hell when managing async event streams',
  },
  'Passport.js': {
    what: 'Authentication middleware สำหรับ Node.js — รองรับ OAuth2, local, JWT, session และ strategy อื่น ๆ กว่า 500 ตัว',
    whatEN: 'Authentication middleware for Node.js — supports OAuth2, local, JWT, session, and 500+ other strategies',
    why: 'จัดการ Google OAuth 2.0 + Facebook OAuth redirect/callback flow; integrate กับ NestJS ได้ native ผ่าน @nestjs/passport',
    whyEN: 'Handles the Google OAuth 2.0 and Facebook OAuth redirect/callback flows; integrates natively with NestJS via @nestjs/passport',
  },
  'Google Gemini AI': {
    what: 'Multimodal AI API จาก Google — text generation, vision, audio, context caching, function calling, streaming responses',
    whatEN: 'Google\'s multimodal AI API — text generation, vision, audio, context caching, function calling, streaming responses',
    why: 'ใช้ใน translateMangaEpisode() สำหรับ text chapter translation; context caching ลด cost เมื่อแปลหลาย page ของ episode เดียวกัน เพราะ cached context ไม่ถูก charge ซ้ำ',
    whyEN: 'Powers translateMangaEpisode() for text chapter translation; context caching reduces cost when translating multiple pages of the same episode since cached context isn\'t re-billed',
  },
  'Jest': {
    what: 'Test framework ครบครัน — test runner, assertion library, mock system (jest.fn/spyOn), coverage report, snapshot testing, fake timers',
    whatEN: 'Full-featured test framework — test runner, assertion library, mock system (jest.fn/spyOn), coverage reports, snapshot testing, fake timers',
    why: 'เป็น default ของ NestJS; integrate ดีกับ ts-jest ทำให้ test TypeScript โดยตรงไม่ต้อง compile ก่อน; ปัจจุบัน 279 tests ครอบคลุม unit + integration ทุก module',
    whyEN: 'NestJS\'s default test framework; integrates well with ts-jest to test TypeScript directly without a prior compile step; currently 279 tests covering unit + integration across all modules',
  },
  'LRU Cache': {
    what: 'Least Recently Used cache ที่ bounded memory — O(1) get/set, optional per-entry TTL, synchronous API ไม่มี overhead',
    whatEN: 'Least Recently Used cache with bounded memory — O(1) get/set, optional per-entry TTL, zero-overhead synchronous API',
    why: 'ใช้เป็น L1 in-memory cache (500 entries) บน Frontend ด้วย stale-while-revalidate pattern ลด API call ซ้ำซ้อน; clearAllApiCache() เรียกเมื่อ auth state เปลี่ยนเพื่อป้องกัน cross-user bleed',
    whyEN: 'Used as the L1 in-memory cache (500 entries) with stale-while-revalidate pattern to reduce redundant API calls; clearAllApiCache() is called on auth state changes to prevent cross-user cache bleed',
  },
  'FastAPI': {
    what: 'Python web framework สำหรับสร้าง API — async-first, Pydantic validation อัตโนมัติ, OpenAPI docs สร้างอัตโนมัติ, dependency injection',
    whatEN: 'Python web framework for building APIs — async-first, automatic Pydantic validation, auto-generated OpenAPI docs, dependency injection',
    why: 'Async-first design ทำให้รัน GPU inference และรับ HTTP request พร้อมกันได้โดยไม่บล็อกกัน; OpenAPI ที่ generate อัตโนมัติช่วย debug endpoints ใหม่ได้เร็ว',
    whyEN: 'Async-first design lets it handle GPU inference and HTTP requests concurrently without blocking; auto-generated OpenAPI docs make debugging new endpoints fast',
  },
  'Uvicorn': {
    what: 'ASGI server สำหรับ Python — asyncio-based, HTTP/1.1 + WebSocket, overhead ต่ำมาก, รองรับ hot reload ตอน dev',
    whatEN: 'ASGI server for Python — asyncio-based, HTTP/1.1 + WebSocket, very low overhead, hot reload in dev',
    why: 'เป็น production-grade ASGI server มาตรฐานสำหรับ FastAPI; รัน port 5003 บน async event loop ทำให้ FastAPI ทำงานได้เต็มประสิทธิภาพ',
    whyEN: 'The standard production-grade ASGI server for FastAPI; runs on port 5003 with an async event loop for full efficiency',
  },
  'PyTorch': {
    what: 'Deep learning framework หลัก — tensor operations บน CPU/GPU, autograd, eager execution + TorchScript, model export (ONNX)',
    whatEN: 'Primary deep learning framework — tensor operations on CPU/GPU, autograd, eager execution + TorchScript, model export (ONNX)',
    why: 'De facto standard ของ ML research; model ทุกตัวที่ใช้ (manga-ocr, HuggingFace transformers) build บน PyTorch ทำให้ integrate ได้โดยตรง',
    whyEN: 'The de facto ML research standard; all models used (manga-ocr, HuggingFace transformers) are built on PyTorch, so they integrate directly',
  },
  'HuggingFace Transformers': {
    what: 'Library สำหรับ access pre-trained models กว่า 100,000 ตัว — OCR, translation, classification, generation; รองรับ PyTorch/TensorFlow/JAX',
    whatEN: 'Library providing access to 100,000+ pre-trained models — OCR, translation, classification, generation; supports PyTorch/TensorFlow/JAX',
    why: 'โหลด pre-trained text detection + translation models โดยตรงโดยไม่ต้องเทรนใหม่; model zoo ครอบคลุมทุก task ที่ MIT server ต้องการ',
    whyEN: 'Loads pre-trained text detection and translation models directly without retraining; the model zoo covers every task the MIT server needs',
  },
  'Google Genai': {
    what: 'Python client สำหรับ Gemini API — vision model, text generation, multimodal input, streaming, function calling',
    whatEN: 'Python client for the Gemini API — vision model support, text generation, multimodal input, streaming, function calling',
    why: 'ใช้ Gemini vision model สำหรับ image-based manga translation — OCR + translate text ในหน้า manga ด้วย single API call แทน multi-step pipeline',
    whyEN: 'Uses Gemini\'s vision model for image-based manga translation — OCR + translates text in manga pages in a single API call instead of a multi-step pipeline',
  },
  'Manga OCR': {
    what: 'Specialized OCR model สำหรับ Japanese manga โดยเฉพาะ — รู้จัก vertical text, handwritten font, furigana, text บน background ซับซ้อน',
    whatEN: 'Specialized OCR model for Japanese manga — recognizes vertical text, handwritten fonts, furigana, and text on complex backgrounds',
    why: 'Manga text มีลักษณะพิเศษที่ general OCR จัดการไม่ดี (vertical, handwritten, furigana); model นี้ train มาเพื่องานนี้โดยเฉพาะ ให้ accuracy สูงกว่ามาก',
    whyEN: 'Manga text has unique characteristics that general OCR handles poorly (vertical orientation, handwritten fonts, furigana); this model was trained specifically for manga and delivers much higher accuracy',
  },
  'OpenCV': {
    what: 'Computer vision library ครบครัน — image processing, feature detection, contour analysis, inpainting, morphological operations',
    whatEN: 'Comprehensive computer vision library — image processing, feature detection, contour analysis, inpainting, morphological operations',
    why: 'Preprocess หน้า manga ก่อนส่ง OCR (noise reduction, binarization); inpaint text bubble ออกก่อนวาง translated text ทับเพื่อให้ผลลัพธ์ดูเป็นธรรมชาติ',
    whyEN: 'Preprocesses manga pages before OCR (noise reduction, binarization); inpaints text bubbles before overlaying translated text for a natural-looking result',
  },
  'CTranslate2': {
    what: 'Optimized inference engine สำหรับ transformer models — quantization (INT8/FP16), CUDA/CPU parallel decoding, low memory footprint',
    whatEN: 'Optimized inference engine for transformer models — quantization (INT8/FP16), CUDA/CPU parallel decoding, low memory footprint',
    why: 'ลด inference latency ของ translation models อย่างมีนัยสำคัญเมื่อเทียบกับ vanilla HuggingFace inference; quantization ลด VRAM ที่ต้องใช้โดยไม่เสีย accuracy มาก',
    whyEN: 'Significantly reduces translation model inference latency vs. vanilla HuggingFace inference; quantization lowers VRAM requirements without much accuracy loss',
  },
  'Pydantic': {
    what: 'Python data validation library — type-annotated models, automatic parsing + coercion, custom validators, JSON schema generation',
    whatEN: 'Python data validation library — type-annotated models, automatic parsing and coercion, custom validators, JSON schema generation',
    why: 'Validate request/response payload ของ FastAPI อัตโนมัติโดยไม่ต้องเขียน validation code เอง; Config class ใช้อ่าน JSON config field จาก Backend ได้สะดวก',
    whyEN: 'Automatically validates FastAPI request/response payloads without writing manual validation code; Config class cleanly reads JSON config fields from the Backend',
  },
  'Pillow': {
    what: 'Python imaging library ครบครัน — open/save/convert ทุกฟอร์แมต (PNG, JPEG, WebP), resize, crop, filter, draw text + shapes',
    whatEN: 'Comprehensive Python imaging library — open/save/convert all formats (PNG, JPEG, WebP), resize, crop, filter, draw text and shapes',
    why: 'แปลง patches ผลลัพธ์จาก translation pipeline เป็น PNG base64 สำหรับส่งกลับ Backend; จัดการ image I/O ทั่วไปในขั้นตอน preprocessing',
    whyEN: 'Converts translation pipeline result patches to PNG base64 for returning to the Backend; handles general image I/O throughout the preprocessing pipeline',
  },
  'httpx': {
    what: 'Modern async HTTP client สำหรับ Python — symmetric async/sync API, HTTP/2, connection pooling, timeout + retry control',
    whatEN: 'Modern async HTTP client for Python — symmetric async/sync API, HTTP/2, connection pooling, timeout and retry control',
    why: 'ส่ง webhook callback ไปยัง Backend หลัง translation เสร็จ พร้อม retry + exponential backoff ใน server/webhook.py; async API ทำงานร่วมกับ FastAPI ได้โดยตรง',
    whyEN: 'Sends webhook callbacks to the Backend after translation completes with retry + exponential backoff in server/webhook.py; async API works natively alongside FastAPI',
  },
  'pythainlp': {
    what: 'Natural language processing สำหรับภาษาไทย — word tokenization (newmm/attacut), POS tagging, transliteration, text normalization',
    whatEN: 'Thai natural language processing — word tokenization (newmm/attacut), POS tagging, transliteration, text normalization',
    why: 'ภาษาไทยไม่มีช่องว่างระหว่างคำ ต้องใช้ newmm engine ตัดคำก่อนจะ line-break ข้อความที่แปลแล้วได้ถูกต้อง ไม่ตัดกลางคำ',
    whyEN: 'Thai has no spaces between words; the newmm engine tokenizes words so translated text can be line-broken correctly without cutting in the middle of a word',
  },
  'Supabase': {
    what: 'PostgreSQL-based Backend-as-a-Service — database, Row-Level Security, Auth (OAuth + email), Storage, Edge Functions, Realtime subscriptions',
    whatEN: 'PostgreSQL-based Backend-as-a-Service — database, Row-Level Security, Auth (OAuth + email), Storage, Edge Functions, Realtime subscriptions',
    why: 'ให้ทั้ง database + auth provider ในที่เดียว ลดจำนวน third-party service; RLS enforce access control ที่ database level โดยตรง ไม่ต้องเขียน middleware เพิ่ม',
    whyEN: 'Provides both database and auth provider in one place, reducing third-party services; RLS enforces access control directly at the database level without extra middleware',
  },
  'Cloudflare Workers': {
    what: 'Serverless edge compute ที่รันใกล้ user — V8 isolates (ไม่ใช่ container), cold start < 5ms, รองรับ KV, R2, D1 bindings',
    whatEN: 'Serverless edge compute running close to users — V8 isolates (not containers), sub-5ms cold starts, KV, R2, and D1 bindings',
    why: 'ใช้เป็น gateway สำหรับ R2 object storage — verify HMAC signature, proxy image, ป้องกัน direct R2 access; latency ต่ำเพราะรันที่ edge ใกล้ user',
    whyEN: 'Acts as the gateway for R2 object storage — verifies HMAC signatures, proxies images, prevents direct R2 access; low latency because it runs at the edge close to users',
  },
  'Cloudflare R2': {
    what: 'S3-compatible object storage — zero egress fee, global CDN distribution, automatic replication, compatible กับ AWS S3 SDK',
    whatEN: 'S3-compatible object storage — zero egress fees, global CDN distribution, automatic replication, compatible with the AWS S3 SDK',
    why: 'เก็บ translated page cache โดยไม่เสีย egress fee (ต่างจาก S3 ที่คิด per-GB); S3-compatible API ทำให้ใช้ StorageProvider interface เดิมได้โดยเปลี่ยนแค่ config',
    whyEN: 'Stores translated page cache with zero egress fees (unlike S3 which charges per GB); S3-compatible API means the existing StorageProvider interface works with only a config change',
  },
  'Redis': {
    what: 'In-memory data store — pub/sub, sorted sets, TTL, Lua scripts, clustering, persistence (RDB/AOF); shared infrastructure ระหว่าง Backend และ MIT server',
    whatEN: 'In-memory data store — pub/sub, sorted sets, TTL, Lua scripts, clustering, persistence (RDB/AOF); shared infrastructure between Backend and MIT server',
    why: 'Instance เดียวทำหน้าที่ทั้ง L2 distributed cache (ลด DB round-trip) และ pub/sub message bus สำหรับ translation fan-out + SSE event distribution ระหว่าง Backend instances',
    whyEN: 'A single instance serves as both the L2 distributed cache (reducing DB round-trips) and the pub/sub message bus for translation fan-out and SSE event distribution across Backend instances',
  },
};

function StatStrip({ stack }: { stack: StackCategory[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {stack.map(cat => (
        <div key={cat.label} className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dotClass}`} aria-hidden="true" />
          <span className="text-[12px] text-[#6e6e73]">
            <span className="font-medium text-[#1d1d1f]">{cat.techs.length}</span>
            {' '}{cat.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Tech detail panel ────────────────────────────────────────────────────────

function TechDetailPanel({
  tech,
  categoryLabel,
  onBack,
}: {
  tech: Tech;
  categoryLabel: string;
  onBack: () => void;
}) {
  const lang = useLang();
  const details = TECH_DETAILS[tech.name];

  return (
    <div className="space-y-7 pb-12">

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors group"
      >
        <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
        Tech Stack
      </button>

      {/* Header */}
      <div className="pb-5 border-b border-black/[0.08]">
        <div className="flex items-start gap-3">
          <span
            className="w-3 h-3 rounded-full mt-[6px] shrink-0"
            style={{ backgroundColor: tech.accent }}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                {tech.name}
              </h1>
              {tech.version && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-black/[0.04] text-[#86868b] leading-none shrink-0">
                  {tech.version.startsWith('≥') ? tech.version : `v${tech.version}`}
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#6e6e73] leading-relaxed">
              {lang === 'en' && tech.roleEN ? tech.roleEN : tech.role}
            </p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-medium bg-[#f5f5f7] border border-black/[0.06] text-[#6e6e73]">
              {categoryLabel}
            </span>
          </div>
        </div>
      </div>

      {details ? (
        <>
          {/* What it does */}
          <section className="space-y-2">
            <h2 className="text-[13px] font-medium text-[#6e6e73]">
              {lang === 'th' ? 'สิ่งที่ทำได้' : 'What it does'}
            </h2>
            <p className="text-[14px] text-[#1d1d1f] leading-relaxed">
              {lang === 'en' ? details.whatEN : details.what}
            </p>
          </section>

          {/* Why we chose it */}
          <section className="space-y-2">
            <h2 className="text-[13px] font-medium text-[#6e6e73]">
              {lang === 'th' ? 'ทำไมถึงเลือกใช้ใน MangaDock' : 'Why we chose it'}
            </h2>
            <p className="text-[14px] text-[#1d1d1f] leading-relaxed">
              {lang === 'en' ? details.whyEN : details.why}
            </p>
          </section>
        </>
      ) : (
        <p className="text-[13px] text-[#86868b]">
          {lang === 'th' ? 'ยังไม่มีข้อมูลเพิ่มเติม' : 'No additional details available'}
        </p>
      )}

      {/* External docs link */}
      <div className="pt-2 border-t border-black/[0.08]">
        <a
          href={tech.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors border border-black/[0.06]"
        >
          <ExternalLink size={13} />
          {lang === 'th' ? 'เปิด Official Docs' : 'Open official docs'}
        </a>
      </div>

    </div>
  );
}

// ─── Tech row ─────────────────────────────────────────────────────────────────

function TechRow({ tech, onSelect }: { tech: Tech; onSelect: (tech: Tech) => void }) {
  const lang = useLang();
  return (
    <div className="group flex items-start gap-1 py-3 px-3 -mx-3 rounded-xl hover:bg-[#f5f5f7] transition-colors border-b border-black/[0.05] last:border-0">
      <button
        onClick={() => onSelect(tech)}
        className="flex items-start gap-3 flex-1 min-w-0 text-left"
        aria-label={`ดูรายละเอียด ${tech.name}`}
      >
        <span
          className="w-2 h-2 rounded-full mt-[5px] shrink-0"
          style={{ backgroundColor: tech.accent }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors leading-snug">
              {tech.name}
            </span>
            {tech.version && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/[0.04] text-[#86868b] leading-none shrink-0">
                {tech.version.startsWith('≥') ? tech.version : `v${tech.version}`}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#6e6e73] mt-0.5 leading-relaxed">
            {lang === 'en' && tech.roleEN ? tech.roleEN : tech.role}
          </p>
        </div>
      </button>
      <a
        href={tech.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`เปิด docs ของ ${tech.name}`}
        onClick={e => e.stopPropagation()}
        className="shrink-0 mt-[5px] p-1.5 rounded text-[#d1d5db] hover:text-[#0071e3] transition-colors"
      >
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function TechStackView() {
  const lang = useLang();
  const totalCount = STACK.reduce((s, c) => s + c.techs.length, 0);
  const [selected, setSelected] = useState<{ tech: Tech; categoryLabel: string } | null>(null);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selected ? (
        <motion.div
          key="detail"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <TechDetailPanel
            tech={selected.tech}
            categoryLabel={selected.categoryLabel}
            onBack={() => setSelected(null)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-10 pb-12"
        >

      {/* Header */}
      <div className="pb-6 border-b border-black/[0.08]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight leading-tight">
              Tech Stack
            </h1>
            <p className="text-[14px] text-[#6e6e73] mt-1.5 leading-relaxed">
              {lang === 'th'
                ? 'เทคโนโลยีทั้งหมดที่ใช้ใน MangaDock — Frontend · Backend · ML Server · Infrastructure'
                : 'All technologies powering MangaDock — Frontend · Backend · ML Server · Infrastructure'}
            </p>
          </div>
          <span className="px-2.5 py-1.5 rounded-lg text-[12px] font-mono bg-[#f5f5f7] border border-black/[0.08] text-[#6e6e73] shrink-0 self-start">
            {totalCount} technologies
          </span>
        </div>
        <div className="mt-4">
          <StatStrip stack={STACK} />
        </div>
      </div>

      {/* Categories */}
      {STACK.map(cat => (
        <section key={cat.label}>

          {/* Category header */}
          <div className="flex items-center gap-2.5 mb-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cat.dotClass}`} aria-hidden="true" />
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">{cat.label}</h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${cat.badgeClass}`}>
              {cat.badge}
            </span>
            <span className="ml-auto text-[11px] font-mono text-[#86868b]">
              {cat.techs.length} libs
            </span>
          </div>

          {/* Sublabel */}
          <p className="text-[11px] text-[#86868b] mb-4 pl-[18px]">{cat.labelTH}</p>

          {/* Tech list */}
          <div>
            {cat.techs.map(tech => (
              <TechRow
                key={tech.name}
                tech={tech}
                onSelect={t => setSelected({ tech: t, categoryLabel: cat.label })}
              />
            ))}
          </div>

        </section>
      ))}

      {/* Footer */}
      <div className="pt-6 border-t border-black/[0.08]">
        <p className="text-[12px] text-[#86868b] leading-relaxed">
          {lang === 'th' ? 'Versions แสดง ณ เวลาที่เขียนเอกสาร — ดู' : 'Versions as of the time of writing — see'}{' '}
          <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-[#f5f5f7] text-[#374151]">
            Frontend/package.json
          </code>
          {', '}
          <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-[#f5f5f7] text-[#374151]">
            Backend/package.json
          </code>
          {', '}
          <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-[#f5f5f7] text-[#374151]">
            MIT/requirements.txt
          </code>{' '}
          {lang === 'th' ? 'สำหรับ versions ล่าสุด' : 'for the latest versions'}
        </p>
      </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
