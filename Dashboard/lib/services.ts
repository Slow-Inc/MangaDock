import {
  Globe,
  Server,
  Cpu,
  Gauge,
  MemoryStick,
  Activity,
  Database,
  Layers,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { LogEntry } from "./log";
import type { VramModel } from "./vram";
import type { NodeRecord } from "./cluster";
import type { CacheTiersInput } from "./cache-tiers";
import type { QueueJob } from "./queue";
import type { Subsystem } from "./health";
import type { GatewayProbe } from "./gateway";
import type { WritePathState } from "./writepath";
import type { StageTiming } from "./timing";
import type { StreamConn } from "./streams";
import type { BwService, BwNode } from "./bandwidth";

export type ServiceStatus = "up" | "down" | "stale";

/** Backend cluster nodes as read from L2 (Redis) — heartbeat + role per ADR 011/016.
 *  CLUSTER_NOW is a fixed reference so SSR and client agree (no Date.now in render). */
export const CLUSTER_NOW = 1_718_383_200_000;
export const BACKEND_NODES: NodeRecord[] = [
  { id: "be-7f3a9c", isLeader: true, lastSeenMs: CLUSTER_NOW - 1200, l1Entries: 8421, dirtyQueue: 3 },
  { id: "be-2b81d4", isLeader: false, lastSeenMs: CLUSTER_NOW - 2600, l1Entries: 8390 },
  { id: "be-c0e5f2", isLeader: false, lastSeenMs: CLUSTER_NOW - 8500, l1Entries: 7905 },
];

/** L1 / L2 / L3 cache-tier state (last-update times). L1 + L3 are per node, L2 is shared (Redis). */
export const CACHE_TIERS: CacheTiersInput = {
  l2: { updatedMs: CLUSTER_NOW - 1100, entries: 12908 },
  nodes: [
    { nodeId: "be-7f3a9c", l1: { updatedMs: CLUSTER_NOW - 400, entries: 8421, bytes: 41_000_000 }, l3: { updatedMs: CLUSTER_NOW - 3200, files: 9210, bytes: 512_000_000, dirtyPending: 3 } },
    { nodeId: "be-2b81d4", l1: { updatedMs: CLUSTER_NOW - 1500, entries: 8390, bytes: 40_600_000 }, l3: { updatedMs: CLUSTER_NOW - 4000, files: 9180, bytes: 510_000_000, dirtyPending: 0 } },
    { nodeId: "be-c0e5f2", l1: { updatedMs: CLUSTER_NOW - 8500, entries: 7905, bytes: 38_100_000 }, l3: { updatedMs: CLUSTER_NOW - 11000, files: 8905, bytes: 498_000_000, dirtyPending: 0 } },
  ],
};

// ── Tier A: incident MVP ──────────────────────────────────────────────
/** Translate queue / batch jobs (manga + requesting user per ADR 016 §Decision3). */
export const QUEUE_JOBS: QueueJob[] = [
  { id: "job-9f2a", user: "xeno", manga: "One-Punch", chapter: "ch1", page: 3, state: "running", stage: "translate", queuedMs: CLUSTER_NOW - 95000, startedMs: CLUSTER_NOW - 90000 },
  { id: "job-4c1d", user: "mira", manga: "Gal Yome", chapter: "ch2", page: 1, state: "queued", queuedMs: CLUSTER_NOW - 12000 },
  { id: "job-7b88", user: "ken", manga: "Berserk", chapter: "ch3", page: 7, state: "queued", queuedMs: CLUSTER_NOW - 4000 },
  { id: "job-2e05", user: "sora", manga: "Vagabond", chapter: "ch5", page: 2, state: "queued", queuedMs: CLUSTER_NOW - 1500 },
  { id: "job-1a33", user: "xeno", manga: "One-Punch", chapter: "ch1", page: 2, state: "done", queuedMs: CLUSTER_NOW - 120000, startedMs: CLUSTER_NOW - 118000 },
];

/** Subsystem / dependency health board. */
export const SUBSYSTEMS: Subsystem[] = [
  { id: "gateway", label: "9arm gateway", kind: "gateway", health: "down", detail: "model timeout ×3", latencyMs: 190 },
  { id: "redis", label: "Redis · L2", kind: "cache", health: "up", detail: "pub/sub ok", latencyMs: 1 },
  { id: "supabase", label: "Supabase", kind: "db", health: "up", detail: "REST ok", latencyMs: 42 },
  { id: "payment", label: "Payment gateway", kind: "payment", health: "up", detail: "Omise · 99.4% ok", latencyMs: 240 },
  { id: "r2", label: "Cloudflare R2", kind: "storage", health: "up", detail: "edge ok", latencyMs: 60 },
  { id: "gpu", label: "GPU · RTX 4070S", kind: "gpu", health: "up", detail: "65% · 5.8/12.3 GB", latencyMs: 0 },
  { id: "disk", label: "L3 disk", kind: "disk", health: "degraded", detail: "1.52 GB · growing unbounded", latencyMs: 0 },
  { id: "mangadex", label: "MangaDex API", kind: "dep", health: "up", detail: "no 429", latencyMs: 310 },
];

/** Translate-gateway probe — the 2026-06-14 signature (control up, data hung). */
export const GATEWAY_PROBE: GatewayProbe = { controlOk: true, controlMs: 190, dataState: "timeout", dataMs: 151000 };

// ── Tier B: resilience ────────────────────────────────────────────────
export const WRITE_PATH: WritePathState = { dirty: 7, processing: 0, deadLetter: 0, lastFlushAgeMs: 2400, slaMs: 5000, leaderHealthy: true };

export const STREAMS: StreamConn[] = [
  { service: "frontend", state: "connected", lastEventMs: CLUSTER_NOW - 1200, revalidatedMs: CLUSTER_NOW - 8000 },
  { service: "backend", state: "connected", lastEventMs: CLUSTER_NOW - 800, revalidatedMs: CLUSTER_NOW - 54000 },
  { service: "mit", state: "reconnecting", lastEventMs: CLUSTER_NOW - 30000, revalidatedMs: CLUSTER_NOW - 30000 },
];

// ── Traffic: users + bandwidth (total → 3 services → backend nodes) ──
export const USERS = { active: 342, total: 12847 };
export const BANDWIDTH_SERVICES: BwService[] = [
  { id: "frontend", name: "Frontend", color: "var(--frontend)", down: 86, up: 14 },
  { id: "backend", name: "Backend", color: "var(--backend)", down: 42, up: 18 },
  { id: "mit", name: "MIT", color: "var(--mit)", down: 14, up: 6 },
];
// Backend's bandwidth, broken down per node (sums to the Backend service row).
export const BANDWIDTH_NODES: BwNode[] = [
  { nodeId: "be-7f3a9c", down: 22, up: 9 },
  { nodeId: "be-2b81d4", down: 13, up: 6 },
  { nodeId: "be-c0e5f2", down: 7, up: 3 },
];

// Per-node deep-dive (uptime, KPIs, disk). be-c0e5f2 recently restarted → low uptime, higher latency.
export const NODE_META: Record<string, { uptime: string; reqPerSec: number; p50: number; errorRate: string; diskUsedPct: number }> = {
  "be-7f3a9c": { uptime: "12d 4h", reqPerSec: 14, p50: 28, errorRate: "0.0%", diskUsedPct: 38 },
  "be-2b81d4": { uptime: "12d 4h", reqPerSec: 11, p50: 31, errorRate: "0.0%", diskUsedPct: 36 },
  "be-c0e5f2": { uptime: "3h 12m", reqPerSec: 7, p50: 44, errorRate: "0.2%", diskUsedPct: 34 },
};

// Homogeneous backend cluster — shared hardware spec.
export const NODE_HARDWARE: { label: string; value: string }[] = [
  { label: "CPU", value: "AMD EPYC 7543" },
  { label: "cores", value: "32C / 64T" },
  { label: "RAM", value: "128 GB DDR4-3200" },
  { label: "disk", value: "2 × 1.92 TB NVMe · RAID1" },
  { label: "NIC", value: "10 GbE" },
  { label: "OS", value: "Ubuntu 24.04 · kernel 6.8" },
];

// Per-node logs (read by the node popup + the AI summary). be-c0e5f2's warn/error explain its stale state.
export const NODE_LOGS: Record<string, LogEntry[]> = {
  "be-7f3a9c": [
    { t: "16:10:14", level: "info", src: "election", msg: "lease renewed · TTL 12.5s · still leader" },
    { t: "16:10:12", level: "info", src: "flush", msg: "BatchSyncWorker drained 7 keys → L3 + Supabase" },
    { t: "16:10:08", level: "info", src: "heartbeat", msg: "cluster_metrics published" },
    { t: "16:10:02", level: "debug", src: "pubsub", msg: "cache:invalidate published · key books:123" },
    { t: "16:09:55", level: "debug", src: "http", msg: "GET /books/123/pages 200 · 28 ms" },
  ],
  "be-2b81d4": [
    { t: "16:10:13", level: "info", src: "heartbeat", msg: "cluster_metrics published" },
    { t: "16:10:10", level: "debug", src: "pubsub", msg: "cache:invalidate received · dropped 1 L1 key" },
    { t: "16:10:01", level: "debug", src: "http", msg: "GET /unlock 200 · 31 ms" },
    { t: "16:09:50", level: "info", src: "election", msg: "follower · leader be-7f3a9c" },
  ],
  "be-c0e5f2": [
    { t: "16:10:06", level: "warn", src: "heartbeat", msg: "missed heartbeat — 8.5s since last publish" },
    { t: "16:10:05", level: "warn", src: "redis", msg: "RTT 180 ms spike · pub/sub lagging" },
    { t: "16:09:58", level: "error", src: "election", msg: "lease renew failed — presumed stale by cluster" },
    { t: "16:09:52", level: "info", src: "l1", msg: "re-syncing L1 from L3 · 7,905 entries" },
  ],
};

// ── Tier C: pipeline quality ──────────────────────────────────────────
export const STAGE_TIMINGS: StageTiming[] = [
  { id: "detect", label: "Detection", baselineMs: 820, liveMs: 840 },
  { id: "ocr", label: "OCR", baselineMs: 1240, liveMs: 1290 },
  { id: "translate", label: "Translate", baselineMs: 3800, liveMs: 90000 },
  { id: "inpaint", label: "Inpaint", baselineMs: 1600, liveMs: 1650 },
  { id: "render", label: "Render", baselineMs: 1200, liveMs: 1240 },
];

/** Resident GPU models on the MIT host. Translate runs off-box (9arm) → no local VRAM. */
export const MIT_HOST_VRAM_TOTAL_GB = 12.3;
export const MIT_VRAM_MODELS: VramModel[] = [
  { id: "detect", label: "Detection", sublabel: "AnimeText YOLO", gb: 1.1, color: "var(--c-detect)" },
  { id: "ocr", label: "OCR", sublabel: "manga-ocr · VLM", gb: 2.4, color: "var(--c-ocr)" },
  { id: "inpaint", label: "Inpaint", sublabel: "LaMa", gb: 0.8, color: "var(--c-inpaint)" },
  { id: "runtime", label: "Runtime", sublabel: "CUDA context", gb: 1.5, color: "var(--idle)" },
  { id: "translate", label: "Translate", sublabel: "qwen3.6 · 9arm", gb: 0, color: "var(--c-translate)", remote: true },
];

export const SERVICE_STATUS_COLOR: Record<ServiceStatus, string> = {
  up: "var(--success)",
  stale: "var(--processing)",
  down: "var(--error)",
};

export interface ServiceStat {
  label: string;
  value: string;
}

export interface ServiceMetric {
  label: string;
  value: number | string;
  unit?: string;
  sub?: string;
  color: string;
  data: number[];
  domain?: [number, number];
  Icon: LucideIcon;
}

export type TerminalTone = "cmd" | "muted" | "ok" | "warn" | "err";

export interface TerminalLine {
  text: string;
  tone?: TerminalTone;
}

export interface Service {
  id: string;
  name: string;
  tech: string;
  status: ServiceStatus;
  metric: string; // one-line headline for the overview node
  detail: string;
  color: string; // CSS custom property
  Icon: LucideIcon;
  errors: number;
  stats: ServiceStat[]; // popup quick-peek
  errorLines?: string[];
  metrics: ServiceMetric[]; // detail-page telemetry
  terminal: TerminalLine[];
  logs: LogEntry[];
}

/** Deterministic sine sparkline — no Math.random, so SSR and client agree (no hydration drift). */
function spark(base: number, amp: number, phase = 0, n = 28) {
  return Array.from({ length: n }, (_, i) => Math.round((base + amp * Math.sin(i / 2.6 + phase)) * 10) / 10);
}

export const SERVICES: Service[] = [
  {
    id: "frontend",
    name: "Frontend",
    tech: "Next.js · :4000",
    status: "up",
    metric: "12 ms p50",
    detail: "routes nominal",
    color: "var(--frontend)",
    Icon: Globe,
    errors: 0,
    stats: [
      { label: "p50 latency", value: "12 ms" },
      { label: "active routes", value: "14" },
      { label: "build", value: "Next.js 16.2" },
      { label: "hydration", value: "clean" },
    ],
    metrics: [
      { label: "requests", value: 42, unit: "/s", color: "var(--frontend)", data: spark(38, 8), sub: "rolling 60s", Icon: Activity },
      { label: "p50 latency", value: 12, unit: "ms", color: "var(--c-render)", data: spark(12, 3, 1), sub: "p99 41 ms", Icon: Zap },
      { label: "error rate", value: "0.0", unit: "%", color: "var(--success)", domain: [0, 5], data: spark(0.2, 0.2, 2), sub: "0 / 2.5k req", Icon: Gauge },
      { label: "cache hit", value: 96, unit: "%", color: "var(--c-ocr)", domain: [0, 100], data: spark(94, 3, 3), sub: "apiCache LRU", Icon: Layers },
    ],
    terminal: [
      { text: "$ bun dev -p 4000", tone: "cmd" },
      { text: "▲ Next.js 16.2.9 (Turbopack)", tone: "muted" },
      { text: "- Local:   http://localhost:4000", tone: "muted" },
      { text: "✓ Ready in 1.2s", tone: "ok" },
      { text: "✓ Compiled /reader/[id] in 240ms", tone: "ok" },
      { text: "GET /reader/123 200 in 12ms", tone: "muted" },
      { text: "GET /api/proxy/books/123/pages 200 in 31ms", tone: "muted" },
      { text: "GET /api/proxy/forum/posts/stream 200 (SSE)", tone: "muted" },
    ],
    logs: [
      { t: "16:08:39", level: "info", src: "router", msg: "/reader/123 served · 12 ms" },
      { t: "16:08:39", level: "debug", src: "apiCache", msg: "L1 hit books:123:pages" },
      { t: "16:08:38", level: "info", src: "proxy", msg: "GET books/123/pages → 200" },
      { t: "16:08:30", level: "debug", src: "turbopack", msg: "HMR /reader/[id] 240 ms" },
    ],
  },
  {
    id: "backend",
    name: "Backend",
    tech: "NestJS · :4001",
    status: "up",
    metric: "28 ms p50",
    detail: "Redis · Supabase ok",
    color: "var(--backend)",
    Icon: Server,
    errors: 0,
    stats: [
      { label: "p50 latency", value: "28 ms" },
      { label: "Redis", value: "connected" },
      { label: "Supabase", value: "ok" },
      { label: "translate queue", value: "1 job" },
    ],
    metrics: [
      { label: "requests", value: 28, unit: "/s", color: "var(--backend)", data: spark(26, 6, 1), sub: "rolling 60s", Icon: Activity },
      { label: "p50 latency", value: 28, unit: "ms", color: "var(--c-render)", data: spark(28, 7, 2), sub: "p99 96 ms", Icon: Zap },
      { label: "Redis ops", value: "1.2", unit: "k/s", color: "var(--error)", data: spark(1.1, 0.3, 3), sub: "L1 cache layer", Icon: Database },
      { label: "queue depth", value: 1, unit: "job", color: "var(--processing)", domain: [0, 8], data: spark(0.8, 0.8, 1), sub: "manga-patch", Icon: Layers },
    ],
    terminal: [
      { text: "$ npm run start:dev", tone: "cmd" },
      { text: "[Nest] LOG  Nest application successfully started", tone: "ok" },
      { text: "[Nest] LOG  RedisService connected · 127.0.0.1:6379", tone: "ok" },
      { text: "[Nest] LOG  SupabaseService ready", tone: "ok" },
      { text: "[books]   GET /books/123/pages 200 28ms", tone: "muted" },
      { text: "[unlock]  HWID verified · wallet debit ok", tone: "muted" },
      { text: "[translate] enqueue manga-patch → MIT :5003", tone: "muted" },
      { text: "[translate] MIT timeout — job requeued (1)", tone: "warn" },
    ],
    logs: [
      { t: "16:10:14", level: "warn", src: "translate", msg: "MIT :5003 timeout — requeued job (1)" },
      { t: "16:08:40", level: "info", src: "cache", msg: "L1 hit · 3 ms" },
      { t: "16:08:40", level: "info", src: "unlock", msg: "chapter unlock · HWID ok · -5 coins" },
      { t: "16:08:39", level: "debug", src: "redis", msg: "GET translate:manga-patches:123" },
    ],
  },
  {
    id: "mit",
    name: "MIT",
    tech: "Python · :5003",
    status: "down",
    metric: "translate failing",
    detail: "9arm model timeout",
    color: "var(--mit)",
    Icon: Cpu,
    errors: 1,
    stats: [
      { label: "pipeline", value: "stuck · translate" },
      { label: "GPU", value: "RTX 4070 SUPER" },
      { label: "VRAM", value: "5.8 / 12.3 GB" },
      { label: "translator", value: "qwen3.6 · 9arm" },
    ],
    errorLines: [
      "custom_openai → gateway.9arm.co / qwen3.6-35b-a3b",
      "POST /chat/completions → timeout ×3 (40 / 60 / 80s)",
      "Exception: ollama servers did not respond quickly enough",
    ],
    metrics: [
      { label: "GPU util", value: 65, unit: "%", color: "var(--c-render)", domain: [0, 100], data: spark(58, 12), sub: "RTX 4070 SUPER", Icon: Gauge },
      { label: "VRAM", value: 5.8, unit: "GB", color: "var(--c-inpaint)", data: spark(5.6, 0.4), sub: "/ 12.3 GB", Icon: MemoryStick },
      { label: "pages/min", value: "0", unit: "", color: "var(--error)", domain: [0, 6], data: spark(0.1, 0.1, 2), sub: "stalled at translate", Icon: Activity },
      { label: "queue depth", value: 1, unit: "job", color: "var(--processing)", domain: [0, 8], data: spark(1, 0.2, 1), sub: "One-Punch ch1 p3", Icon: Layers },
    ],
    terminal: [
      { text: "$ .venv/Scripts/python -m manga_translator --mode server --port 5003", tone: "cmd" },
      { text: "INFO:     Uvicorn running on http://0.0.0.0:5003", tone: "muted" },
      { text: "[worker] CUDA available · RTX 4070 SUPER · 12.3 GB", tone: "ok" },
      { text: "[worker] resident: detection(AnimeText) ocr(manga-ocr) inpaint(LaMa) · 5.8 GB", tone: "ok" },
      { text: "[pipeline] One-Punch ch1 p3 → detect 8 regions (0.82s)", tone: "ok" },
      { text: "[pipeline] ocr 8 lines + 1 SFX rescued (1.24s)", tone: "ok" },
      { text: "[translate] custom_openai → gateway.9arm.co / qwen3.6", tone: "muted" },
      { text: "[translate] POST /chat/completions … timeout (40s) — retry 1/3", tone: "warn" },
      { text: "[translate] POST /chat/completions … timeout (60s) — retry 2/3", tone: "warn" },
      { text: "[translate] POST /chat/completions … timeout (80s) — retry 3/3", tone: "warn" },
      { text: "ERROR: ollama servers did not respond quickly enough", tone: "err" },
    ],
    logs: [
      { t: "16:10:14", level: "error", src: "translate", msg: "9arm gateway timeout ×3 — pipeline stalled" },
      { t: "16:10:10", level: "warn", src: "translate", msg: "retry 3/3 exhausted (40/60/80s)" },
      { t: "16:08:42", level: "info", src: "ocr", msg: "8 lines + 1 SFX rescued · 1.24s" },
      { t: "16:08:41", level: "info", src: "detect", msg: "AnimeText YOLO · 8 regions · 0.82s" },
      { t: "16:08:41", level: "info", src: "worker", msg: "models resident · 5.8 GB VRAM" },
      { t: "16:08:40", level: "debug", src: "http", msg: "GET /models → 200 · 0.19s" },
    ],
  },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}
