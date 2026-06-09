import type { SimScenario, SimNode } from '../engine';

const UNLOCK_NODES: SimNode[] = [
  { id: 'browser',    label: 'Browser',        sub: 'user' },
  { id: 'frontend',   label: 'Frontend',       sub: 'Bearer + HWID' },
  { id: 'hwid',       label: 'HWID Middleware', sub: 'zero-trust check' },
  { id: 'wallet',     label: 'Wallet Service', sub: 'coin balance' },
  { id: 'unlock_svc', label: 'UnlockService',  sub: 'idempotency + record' },
  { id: 'supabase',   label: 'Supabase',       sub: 'unlock_records' },
];

const HWID_NODES: SimNode[] = [
  { id: 'browser',  label: 'Browser',         sub: 'X-Hardware-Id: B' },
  { id: 'frontend', label: 'Frontend',        sub: '/api/proxy/' },
  { id: 'hwid',     label: 'HWID Middleware', sub: 'compare stored HWID' },
  { id: 'blocked',  label: '403 Forbidden',   sub: 'access denied' },
];

const COINS_NODES: SimNode[] = [
  { id: 'browser',    label: 'Browser',        sub: 'user' },
  { id: 'frontend',   label: 'Frontend',       sub: 'Bearer + HWID' },
  { id: 'hwid',       label: 'HWID Middleware', sub: 'HWID ok' },
  { id: 'wallet',     label: 'Wallet Service', sub: '5 coins < 10 needed' },
  { id: 'rejected',   label: '402 Rejected',   sub: 'insufficient coins' },
];

export const unlockScenarios: SimScenario[] = [
  {
    id: 'unlock-happy',
    labelEN: 'Happy Path (unlock success)',
    labelTH: 'Unlock สำเร็จ',
    badge: 'OK',
    layout: 'linear',
    nodes: UNLOCK_NODES,
    steps: [
      {
        descEN: 'User clicks "ปลดล็อก Chapter"',
        descTH: 'ผู้ใช้กด "ปลดล็อก Chapter"',
        techEN: 'Frontend sends unlock request with Authorization: Bearer <jwt> and X-Hardware-Id header. Both are required — missing either results in 400/403.',
        techTH: 'Frontend ส่ง unlock request พร้อม Authorization: Bearer <jwt> และ X-Hardware-Id header — ขาดอันใดอันหนึ่งจะได้ 400/403',
        states: { browser: 'active' },
      },
      {
        descEN: 'HardwareIdMiddleware validates HWID',
        descTH: 'HardwareIdMiddleware ตรวจ HWID',
        techEN: 'NestJS middleware runs before any guard. It checks that the X-Hardware-Id header is present and matches the device registered to this user in Supabase.',
        techTH: 'NestJS middleware รัน ก่อน guard — ตรวจว่า X-Hardware-Id header มีอยู่และตรงกับ device ที่ user ลงทะเบียนไว้',
        states: { browser: 'ok', frontend: 'ok', hwid: 'active' },
      },
      {
        descEN: 'HWID valid — check idempotency',
        descTH: 'HWID valid — ตรวจ idempotency',
        techEN: 'UnlockService first checks if an unlock_record already exists for this user + chapter combination. If so, returns success immediately without charging again.',
        techTH: 'UnlockService ตรวจก่อนว่ามี unlock_record สำหรับ user + chapter นี้แล้วหรือยัง ถ้ามีแล้วคืนผลสำเร็จโดยไม่หักเหรียญซ้ำ',
        states: { browser: 'ok', frontend: 'ok', hwid: 'ok', unlock_svc: 'active' },
      },
      {
        descEN: 'Wallet debit — atomically deduct coins',
        descTH: 'Wallet debit — หักเหรียญแบบ atomic',
        techEN: 'WalletService deducts the chapter price from the user\'s coin balance using a Supabase transaction. Atomic operation — balance check and deduct happen together.',
        techTH: 'WalletService หักเหรียญตามราคา chapter ด้วย Supabase transaction — balance check และ deduct เกิดพร้อมกันใน transaction เดียว',
        states: { browser: 'ok', frontend: 'ok', hwid: 'ok', unlock_svc: 'ok', wallet: 'active' },
      },
      {
        descEN: 'unlock_record created in Supabase',
        descTH: 'สร้าง unlock_record ใน Supabase',
        techEN: 'UnlockService inserts a row in unlock_records(userId, chapterId, unlockedAt). This is the durable proof of access — checked on every subsequent read request.',
        techTH: 'UnlockService insert row ใน unlock_records(userId, chapterId, unlockedAt) — เป็นหลักฐาน access ที่ถาวร ตรวจทุกครั้งที่อ่าน chapter',
        states: { browser: 'ok', frontend: 'ok', hwid: 'ok', unlock_svc: 'ok', wallet: 'ok', supabase: 'active' },
      },
      {
        descEN: 'Chapter access granted — user can read',
        descTH: 'ปลดล็อกสำเร็จ — อ่าน chapter ได้',
        techEN: 'Response returns the chapter pages. Future requests for this chapter are served directly from unlock_records without charging again.',
        techTH: 'Response คืน chapter pages กลับมา — request ครั้งต่อไปสำหรับ chapter เดิมจะ serve จาก unlock_records โดยตรง ไม่หักเหรียญซ้ำ',
        states: { browser: 'ok', frontend: 'ok', hwid: 'ok', unlock_svc: 'ok', wallet: 'ok', supabase: 'ok' },
      },
    ],
  },
  {
    id: 'unlock-hwid',
    labelEN: 'HWID Mismatch (device lock)',
    labelTH: 'HWID ไม่ตรง',
    badge: 'HW',
    layout: 'linear',
    nodes: HWID_NODES,
    steps: [
      {
        descEN: 'Request arrives with wrong device ID',
        descTH: 'Request มาพร้อม device ID ผิด',
        techEN: 'Browser sends X-Hardware-Id: "device-B", but this user\'s registered hardware ID is "device-A". The mismatch will be caught before any other processing.',
        techTH: 'Browser ส่ง X-Hardware-Id: "device-B" แต่ HWID ที่ลงทะเบียนไว้คือ "device-A" — ความไม่ตรงจะถูกตรวจพบก่อน logic อื่น',
        states: { browser: 'active' },
      },
      {
        descEN: 'Frontend forwards to Backend',
        descTH: 'Frontend ส่งต่อไป Backend',
        techEN: 'Frontend proxy passes the request through with the incorrect HWID header intact.',
        techTH: 'Frontend proxy ส่งต่อ request ไปพร้อม HWID header ที่ผิด',
        states: { browser: 'ok', frontend: 'active' },
      },
      {
        descEN: 'HWID Middleware detects mismatch',
        descTH: 'HWID Middleware ตรวจพบ mismatch',
        techEN: 'Middleware compares the X-Hardware-Id header against the stored device ID for this user. "device-B" ≠ "device-A" → access denied immediately.',
        techTH: 'Middleware เปรียบเทียบ X-Hardware-Id header กับ device ID ที่บันทึกไว้ — "device-B" ≠ "device-A" → ปฏิเสธทันที',
        states: { browser: 'ok', frontend: 'ok', hwid: 'err' },
      },
      {
        descEN: '403 Forbidden — no charge, no record',
        descTH: '403 Forbidden — ไม่หักเหรียญ ไม่สร้าง record',
        techEN: 'Request rejected with 403 Forbidden. Wallet is never debited. No unlock_record is created. Chapter remains locked. Frontend shows "อุปกรณ์ไม่ตรงกัน" error.',
        techTH: 'Request ถูกปฏิเสธด้วย 403 Forbidden — wallet ไม่ถูกหัก, unlock_record ไม่ถูกสร้าง, chapter ยังล็อกอยู่, Frontend แสดง "อุปกรณ์ไม่ตรงกัน"',
        states: { browser: 'ok', frontend: 'ok', hwid: 'err', blocked: 'err' },
      },
    ],
  },
  {
    id: 'unlock-coins',
    labelEN: 'Insufficient Coins',
    labelTH: 'เหรียญไม่พอ',
    badge: 'NC',
    layout: 'linear',
    nodes: COINS_NODES,
    steps: [
      {
        descEN: 'User requests chapter unlock',
        descTH: 'ผู้ใช้ขอ unlock chapter',
        techEN: 'Frontend sends unlock request with valid Bearer token and correct HWID. The HWID check will pass, but the wallet check will fail.',
        techTH: 'Frontend ส่ง unlock request พร้อม Bearer token ที่ถูกต้องและ HWID ที่ถูกต้อง — HWID check ผ่าน แต่ wallet check จะ fail',
        states: { browser: 'active' },
      },
      {
        descEN: 'HWID Middleware — check passes',
        descTH: 'HWID Middleware — ผ่าน',
        techEN: 'X-Hardware-Id matches the registered device for this user. Middleware allows the request to proceed to UnlockService.',
        techTH: 'X-Hardware-Id ตรงกับ device ที่ลงทะเบียนไว้ — Middleware อนุญาตให้ request ผ่านไปยัง UnlockService',
        states: { browser: 'ok', frontend: 'ok', hwid: 'ok' },
      },
      {
        descEN: 'Wallet check: 5 coins, need 10',
        descTH: 'Wallet check: มี 5 เหรียญ ต้องการ 10',
        techEN: 'WalletService queries the current balance: 5 coins. Chapter price is 10 coins. Balance insufficient — debit would put balance below zero.',
        techTH: 'WalletService ตรวจ balance ปัจจุบัน: 5 เหรียญ — ราคา chapter: 10 เหรียญ — balance ไม่พอ',
        states: { browser: 'ok', frontend: 'ok', hwid: 'ok', wallet: 'err' },
      },
      {
        descEN: '402 Payment Required — no debit',
        descTH: '402 Payment Required — ไม่หักเหรียญ',
        techEN: 'WalletService rejects with 402 Payment Required. No debit occurs, no unlock_record is created. Frontend shows "เหรียญไม่พอ" with a top-up prompt.',
        techTH: 'WalletService ปฏิเสธด้วย 402 Payment Required — ไม่หักเหรียญ, ไม่สร้าง unlock_record, Frontend แสดง "เหรียญไม่พอ" พร้อม prompt เติมเหรียญ',
        states: { browser: 'ok', frontend: 'ok', hwid: 'ok', wallet: 'err', rejected: 'err' },
      },
    ],
  },
];
