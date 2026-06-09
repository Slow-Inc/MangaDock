import type { SimScenario, SimNode } from '../engine';

const PROXY_NODES: SimNode[] = [
  { id: 'browser',  label: 'Browser',    sub: 'user' },
  { id: 'nextjs',   label: 'Next.js',    sub: 'next.config rewrite' },
  { id: 'backend',  label: 'Backend',    sub: 'NestJS :4001' },
  { id: 'hwid_mw',  label: 'HWID Check', sub: '1-hour time window' },
  { id: 'disk',     label: 'Local Disk', sub: '/uploads/' },
];

const R2_NODES: SimNode[] = [
  { id: 'browser',    label: 'Browser',    sub: 'user' },
  { id: 'cf_worker',  label: 'CF Worker',  sub: 'edge node' },
  { id: 'backend',    label: 'Backend',    sub: 'HWID verify' },
  { id: 'r2',         label: 'R2 Storage', sub: 'Cloudflare' },
];

export const assetScenarios: SimScenario[] = [
  {
    id: 'assets-proxy',
    labelEN: 'Current: Backend Proxy',
    labelTH: 'ปัจจุบัน: Backend Proxy',
    badge: 'BE',
    layout: 'linear',
    nodes: PROXY_NODES,
    steps: [
      {
        descEN: 'Browser requests chapter image',
        descTH: 'Browser ขอรูปภาพ chapter',
        techEN: 'Browser requests /uploads/chapter/xxx.jpg — a static asset URL. Next.js intercepts this before it leaves the browser.',
        techTH: 'Browser request /uploads/chapter/xxx.jpg — Next.js intercept ก่อนออกจาก browser',
        states: { browser: 'active' },
      },
      {
        descEN: 'next.config rewrite — forwards to Backend',
        descTH: 'next.config rewrite — ส่งต่อไป Backend',
        techEN: 'next.config.ts rewrite rule matches /uploads/* and /img-cache/* and proxies the request to Backend (:4001). This is server-side — the browser doesn\'t see the backend URL.',
        techTH: 'next.config.ts rewrite rule match /uploads/* และ /img-cache/* → proxy ไป Backend (:4001) ฝั่ง server — browser ไม่เห็น URL ของ Backend',
        states: { browser: 'ok', nextjs: 'active' },
      },
      {
        descEN: 'Backend HWID + time-window check',
        descTH: 'Backend ตรวจ HWID + time window',
        techEN: 'HardwareIdMiddleware validates the X-Hardware-Id header and checks that the request falls within the 1-hour access window for this chapter. Zero-trust asset protection.',
        techTH: 'HardwareIdMiddleware ตรวจ X-Hardware-Id header และตรวจว่า request อยู่ใน 1-hour access window สำหรับ chapter นี้ — zero-trust asset protection',
        states: { browser: 'ok', nextjs: 'ok', backend: 'ok', hwid_mw: 'active' },
      },
      {
        descEN: 'HWID valid — reads from local disk',
        descTH: 'HWID valid — อ่านไฟล์จาก disk',
        techEN: 'Check passes. Backend reads the image file from the local /uploads/ directory and streams it into the response.',
        techTH: 'Check ผ่าน Backend อ่านไฟล์รูปจาก /uploads/ directory บน local disk แล้ว stream ลง response',
        states: { browser: 'ok', nextjs: 'ok', backend: 'ok', hwid_mw: 'ok', disk: 'active' },
      },
      {
        descEN: 'Image served — travels through 2 proxies',
        descTH: 'ส่งรูป — ผ่าน proxy 2 ชั้น',
        techEN: 'Image bytes travel: Disk → Backend → Next.js → Browser. Two proxy hops add latency and consume Backend bandwidth. This is the limitation Phase 2 (R2 + CF Worker) solves.',
        techTH: 'ไฟล์เดินทาง: Disk → Backend → Next.js → Browser ผ่าน proxy 2 ชั้น เพิ่ม latency และใช้ Backend bandwidth — ปัญหานี้คือสิ่งที่ Phase 2 (R2 + CF Worker) แก้ไข',
        states: { browser: 'ok', nextjs: 'ok', backend: 'ok', hwid_mw: 'ok', disk: 'ok' },
      },
    ],
  },
  {
    id: 'assets-r2',
    labelEN: 'Phase 2: R2 Edge (planned)',
    labelTH: 'Phase 2: R2 Edge',
    badge: 'CF',
    layout: 'linear',
    nodes: R2_NODES,
    steps: [
      {
        descEN: 'Browser requests chapter image',
        descTH: 'Browser ขอรูปภาพ chapter',
        techEN: 'Browser requests the asset URL — now routed to a Cloudflare Worker at the nearest edge point of presence (PoP) instead of the Next.js server.',
        techTH: 'Browser request URL รูปภาพ — ครั้งนี้ถูก route ไปยัง Cloudflare Worker ที่ edge PoP ที่ใกล้ที่สุด แทนที่จะเป็น Next.js server',
        states: { browser: 'active' },
      },
      {
        descEN: 'CF Worker verifies HWID with Backend',
        descTH: 'CF Worker ตรวจ HWID กับ Backend',
        techEN: 'Worker makes a lightweight API call to Backend to verify the X-Hardware-Id and time-window. Only the HWID check travels to Backend — not the asset bytes.',
        techTH: 'Worker เรียก API เบาๆ ไปยัง Backend เพื่อ verify X-Hardware-Id และ time window — เฉพาะ HWID check ที่เดินทางไป Backend ไม่ใช่ asset bytes',
        states: { browser: 'ok', cf_worker: 'active', backend: 'active' },
      },
      {
        descEN: 'Backend confirms access — Worker authorized',
        descTH: 'Backend ยืนยัน — Worker ได้รับอนุญาต',
        techEN: 'Backend validates HWID and access window, returns confirmation. Worker now has authorization to serve the asset from R2.',
        techTH: 'Backend validate HWID และ access window แล้วส่งการยืนยันกลับ Worker ได้รับอนุญาตให้ serve asset จาก R2',
        states: { browser: 'ok', cf_worker: 'ok', backend: 'ok' },
      },
      {
        descEN: 'Worker fetches from R2 — same Cloudflare network',
        descTH: 'Worker ดึงจาก R2 — ใน Cloudflare network',
        techEN: 'Worker fetches the image directly from R2 Storage. Because both Worker and R2 run on Cloudflare\'s internal network, this transfer is free and extremely fast.',
        techTH: 'Worker ดึงรูปจาก R2 Storage โดยตรง เพราะ Worker และ R2 อยู่บน Cloudflare internal network เดียวกัน การ transfer นี้ฟรีและเร็วมาก',
        states: { browser: 'ok', cf_worker: 'active', backend: 'ok', r2: 'active' },
      },
      {
        descEN: 'Asset served from CDN edge — low latency',
        descTH: 'ส่งรูปจาก CDN edge — latency ต่ำ',
        techEN: 'Image served directly from the nearest Cloudflare edge to the user. No Backend proxy, no Next.js hop. Bandwidth cost: $0 (R2 free egress within Cloudflare network). Latency: dramatically lower.',
        techTH: 'รูปถูกส่งจาก Cloudflare edge ที่ใกล้ผู้ใช้ที่สุด ไม่ผ่าน Backend proxy ไม่ผ่าน Next.js — bandwidth cost: $0 (R2 egress ใน Cloudflare network ฟรี) latency ต่ำกว่ามาก',
        states: { browser: 'ok', cf_worker: 'ok', backend: 'ok', r2: 'ok' },
      },
    ],
  },
];
