import type { SimScenario, SimNode } from '../engine';

const BROADCAST_NODES: SimNode[] = [
  { id: 'browser_a',  label: 'Browser A',     sub: 'reading / connected' },
  { id: 'frontend',   label: 'Frontend',      sub: 'SSE proxy' },
  { id: 'backend',    label: 'Backend',       sub: 'SSE endpoint' },
  { id: 'forum_svc',  label: 'ForumEvents',   sub: 'RxJS Subject' },
  { id: 'redis',      label: 'Redis',         sub: 'forum:events channel' },
  { id: 'browser_b',  label: 'Browser B',     sub: 'posting comment' },
];

const RECONNECT_NODES: SimNode[] = [
  { id: 'browser',   label: 'Browser',    sub: 'EventSource' },
  { id: 'frontend',  label: 'Frontend',   sub: 'SSE endpoint' },
  { id: 'redis',     label: 'Redis',      sub: 'event buffer' },
];

export const sseScenarios: SimScenario[] = [
  {
    id: 'sse-broadcast',
    labelEN: 'Forum Post Broadcast',
    labelTH: 'Forum Broadcast',
    badge: 'BC',
    layout: 'linear',
    nodes: BROADCAST_NODES,
    steps: [
      {
        descEN: 'Browser A opens forum post — connects SSE',
        descTH: 'Browser A เปิด forum post — เชื่อม SSE',
        techEN: 'Browser A navigates to a forum post. The useForumStream hook establishes an EventSource connection to /api/proxy/forum/posts/:id/stream.',
        techTH: 'Browser A เปิด forum post → useForumStream hook สร้าง EventSource เชื่อมต่อ /api/proxy/forum/posts/:id/stream',
        states: { browser_a: 'active', frontend: 'active', backend: 'active' },
      },
      {
        descEN: 'SSE connection established — Browser A waiting',
        descTH: 'SSE เชื่อมต่อแล้ว — Browser A รอรับ events',
        techEN: 'The SSE connection is open. Backend holds the response stream open and sends events as they arrive. Browser A is now subscribed to this post\'s event channel.',
        techTH: 'SSE connection เปิดแล้ว Backend ถือ response stream ไว้เปิด ส่ง events เมื่อมาถึง Browser A subscribe กับ event channel ของ post นี้',
        states: { browser_a: 'ok', frontend: 'ok', backend: 'ok' },
      },
      {
        descEN: 'Browser B posts a new comment',
        descTH: 'Browser B โพสต์ comment ใหม่',
        techEN: 'A different user (Browser B) submits a new comment via a normal HTTP POST to the forum endpoint — unaware of who is currently watching.',
        techTH: 'ผู้ใช้อีกคน (Browser B) ส่ง comment ใหม่ผ่าน HTTP POST ปกติ — ไม่รู้ว่าใครกำลัง watch อยู่',
        states: { browser_a: 'ok', frontend: 'ok', backend: 'ok', browser_b: 'active' },
      },
      {
        descEN: 'Backend stores comment — publishes to Redis',
        descTH: 'Backend บันทึก comment — publish ไป Redis',
        techEN: 'Backend saves the comment to Supabase, then publishes an event to the Redis pub/sub channel "forum:events" with the comment payload.',
        techTH: 'Backend บันทึก comment ลง Supabase แล้ว publish event ไปยัง Redis pub/sub channel "forum:events" พร้อม comment payload',
        states: { browser_a: 'ok', frontend: 'ok', backend: 'active', redis: 'active', browser_b: 'ok' },
      },
      {
        descEN: 'ForumEventsService receives from Redis',
        descTH: 'ForumEventsService รับ event จาก Redis',
        techEN: 'ForumEventsService has a Redis subscriber on "forum:events". It receives the event and pushes it into the RxJS Subject for the relevant post ID.',
        techTH: 'ForumEventsService มี Redis subscriber บน "forum:events" → รับ event → push เข้า RxJS Subject สำหรับ post ID ที่เกี่ยวข้อง',
        states: { browser_a: 'ok', frontend: 'ok', backend: 'ok', forum_svc: 'active', redis: 'ok', browser_b: 'ok' },
      },
      {
        descEN: 'SSE pushes event to all connected clients',
        descTH: 'SSE ส่ง event ไปยัง clients ทั้งหมดที่เชื่อมต่ออยู่',
        techEN: 'The SSE endpoint subscribes to the RxJS Subject and writes each event to the response stream. All clients watching this post receive the event simultaneously.',
        techTH: 'SSE endpoint subscribe กับ RxJS Subject → เขียน event ลง response stream — clients ทุกคนที่ watch post นี้รับ event พร้อมกัน',
        states: { browser_a: 'active', frontend: 'ok', backend: 'active', forum_svc: 'ok', redis: 'ok', browser_b: 'ok' },
      },
      {
        descEN: 'Browser A updates UI — no page reload',
        descTH: 'Browser A update UI — ไม่ต้อง reload',
        techEN: 'Browser A\'s useForumStream hook receives the SSE event, parses it, and updates the React state. The new comment appears instantly without any page reload or polling.',
        techTH: 'useForumStream hook ใน Browser A รับ SSE event, parse แล้ว update React state — comment ใหม่ปรากฏทันทีโดยไม่ต้อง reload หรือ poll',
        states: { browser_a: 'ok', frontend: 'ok', backend: 'ok', forum_svc: 'ok', redis: 'ok', browser_b: 'ok' },
      },
    ],
  },
  {
    id: 'sse-reconnect',
    labelEN: 'Client Reconnect (exponential backoff)',
    labelTH: 'Client Reconnect',
    badge: 'RX',
    layout: 'linear',
    nodes: RECONNECT_NODES,
    steps: [
      {
        descEN: 'SSE connection is active',
        descTH: 'SSE connection กำลังทำงาน',
        techEN: 'Browser EventSource is connected and receiving events normally. The connection is a long-lived HTTP response held open by the server.',
        techTH: 'Browser EventSource เชื่อมต่ออยู่และรับ events ปกติ — connection คือ HTTP response ที่ถือค้างไว้',
        states: { browser: 'ok', frontend: 'ok', redis: 'ok' },
      },
      {
        descEN: 'Network drops — connection lost',
        descTH: 'Network drop — connection หลุด',
        techEN: 'Network interruption or server restart closes the SSE stream. The EventSource readyState changes to CONNECTING. No data is lost — events are buffered in Redis.',
        techTH: 'Network หยุด หรือ server restart → SSE stream ถูกปิด EventSource readyState เปลี่ยนเป็น CONNECTING — ข้อมูลไม่หาย events ถูก buffer ใน Redis',
        states: { browser: 'err', frontend: 'err', redis: 'ok' },
      },
      {
        descEN: 'EventSource schedules retry in 1 second',
        descTH: 'EventSource กำหนด retry ใน 1 วินาที',
        techEN: 'The useForumStream hook implements exponential backoff: first retry after 1s, then 2s, 4s, up to 30s max. The backoff timer starts counting.',
        techTH: 'useForumStream hook ใช้ exponential backoff: retry ครั้งแรก 1 วินาที, ครั้งถัดไป 2s, 4s, สูงสุด 30s — timer เริ่มนับ',
        states: { browser: 'active', frontend: 'err', redis: 'ok' },
      },
      {
        descEN: 'Reconnect attempt 1 — fails',
        descTH: 'ลอง reconnect ครั้งที่ 1 — ล้มเหลว',
        techEN: 'First reconnect attempt after 1s. Backend still unavailable (restarting). EventSource detects the failure and doubles the next retry interval to 2s.',
        techTH: 'ลอง reconnect หลัง 1 วินาที Backend ยังไม่พร้อม (กำลัง restart) EventSource detect failure → double interval เป็น 2s',
        states: { browser: 'err', frontend: 'err', redis: 'ok' },
      },
      {
        descEN: 'Reconnect attempt 2 — succeeds',
        descTH: 'ลอง reconnect ครั้งที่ 2 — สำเร็จ',
        techEN: 'After 2s backoff, the backend is back up. EventSource reconnects successfully. The SSE stream resumes.',
        techTH: 'หลังรอ 2 วินาที Backend กลับมาแล้ว EventSource reconnect สำเร็จ SSE stream กลับมาทำงาน',
        states: { browser: 'active', frontend: 'active', redis: 'ok' },
      },
      {
        descEN: 'Connection restored — no events missed',
        descTH: 'Connection คืนสภาพ — ไม่พลาด events',
        techEN: 'Backend replays recent events from Redis that occurred during the disconnect. The client receives all missed events and the UI is up to date.',
        techTH: 'Backend replay events ล่าสุดจาก Redis ที่เกิดขึ้นระหว่าง disconnect — client ได้รับ events ที่พลาดไปทั้งหมด UI ทันสมัย',
        states: { browser: 'ok', frontend: 'ok', redis: 'ok' },
      },
    ],
  },
];
