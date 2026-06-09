import type { SimScenario, SimNode } from '../engine';

const AUTH_NODES: SimNode[] = [
  { id: 'browser',    label: 'Browser',       sub: 'user' },
  { id: 'frontend',   label: 'Frontend',      sub: 'Next.js :4000' },
  { id: 'supabase',   label: 'Supabase Auth', sub: 'JWT issuer' },
  { id: 'google',     label: 'Google OAuth',  sub: 'identity provider' },
];

const JWT_NODES: SimNode[] = [
  { id: 'browser',    label: 'Browser',      sub: 'Bearer token' },
  { id: 'frontend',   label: 'Frontend',     sub: '/api/proxy/' },
  { id: 'guard',      label: 'AuthGuard',    sub: 'NestJS guard' },
  { id: 'supabase',   label: 'Supabase',     sub: 'public key verify' },
  { id: 'controller', label: 'Controller',   sub: 'request handler' },
];

const REFRESH_NODES: SimNode[] = [
  { id: 'browser',  label: 'Browser',        sub: 'user' },
  { id: 'client',   label: 'Supabase Client',sub: 'auto-refresh' },
  { id: 'supabase', label: 'Supabase Auth',  sub: 'refresh endpoint' },
];

export const authScenarios: SimScenario[] = [
  {
    id: 'auth-login',
    labelEN: 'Google OAuth Login',
    labelTH: 'Google OAuth Login',
    badge: 'OA',
    layout: 'linear',
    nodes: AUTH_NODES,
    steps: [
      {
        descEN: 'User clicks "เข้าสู่ระบบ"',
        descTH: 'ผู้ใช้กดปุ่มเข้าสู่ระบบ',
        techEN: 'Browser triggers the Supabase Auth OAuth flow. The client-side supabase-js library calls signInWithOAuth({provider: "google"}).',
        techTH: 'Browser เรียก Supabase Auth OAuth flow ผ่าน supabase-js ฝั่ง client',
        states: { browser: 'active' },
      },
      {
        descEN: 'Frontend redirects to Supabase Auth',
        descTH: 'Frontend redirect → Supabase Auth',
        techEN: 'Frontend redirects the browser to Supabase\'s OAuth endpoint, which will broker the Google OAuth flow.',
        techTH: 'Frontend redirect browser ไปยัง Supabase Auth OAuth endpoint เพื่อ broker Google OAuth flow',
        states: { browser: 'ok', frontend: 'ok', supabase: 'active' },
      },
      {
        descEN: 'Supabase redirects to Google consent screen',
        descTH: 'Supabase redirect → Google OAuth',
        techEN: 'Supabase sends the browser to accounts.google.com with OAuth parameters. User sees the Google account chooser / consent screen.',
        techTH: 'Supabase ส่ง browser ไปยัง accounts.google.com พร้อม OAuth parameters — ผู้ใช้เห็น Google account chooser',
        states: { browser: 'ok', frontend: 'ok', supabase: 'ok', google: 'active' },
      },
      {
        descEN: 'User approves — Google returns auth code',
        descTH: 'ผู้ใช้อนุญาต — Google ส่ง auth code',
        techEN: 'User clicks "Allow". Google redirects back to Supabase callback URL with an authorization code. Supabase exchanges the code for Google tokens.',
        techTH: 'ผู้ใช้กด Allow → Google redirect กลับ Supabase callback URL พร้อม authorization code → Supabase แลก code เป็น Google tokens',
        states: { browser: 'ok', frontend: 'ok', supabase: 'active', google: 'ok' },
      },
      {
        descEN: 'Supabase issues JWT — returns to Frontend',
        descTH: 'Supabase ออก JWT → คืนให้ Frontend',
        techEN: 'Supabase validates the Google tokens and creates a user record if new. Issues a signed JWT (access_token + refresh_token) and redirects the browser back to the app.',
        techTH: 'Supabase validate Google tokens → สร้าง user record ถ้าใหม่ → ออก JWT (access_token + refresh_token) → redirect browser กลับแอป',
        states: { browser: 'ok', frontend: 'active', supabase: 'ok', google: 'ok' },
      },
      {
        descEN: 'JWT stored — user is logged in',
        descTH: 'เก็บ JWT — ผู้ใช้ logged in แล้ว',
        techEN: 'Frontend AuthContext receives the session from Supabase\'s onAuthStateChange event. The AppUser object is updated and the app re-renders with the authenticated state.',
        techTH: 'Frontend AuthContext รับ session จาก onAuthStateChange event → AppUser object ถูก update → แอป re-render ในสถานะ authenticated',
        states: { browser: 'ok', frontend: 'ok', supabase: 'ok', google: 'ok' },
      },
    ],
  },
  {
    id: 'auth-jwt',
    labelEN: 'JWT Validation (every request)',
    labelTH: 'JWT Validation',
    badge: 'JWT',
    layout: 'linear',
    nodes: JWT_NODES,
    steps: [
      {
        descEN: 'Browser sends request with Bearer token',
        descTH: 'Browser ส่ง request พร้อม Bearer token',
        techEN: 'Every authenticated API call includes "Authorization: Bearer <jwt>" in headers. The JWT is the Supabase access_token stored in the browser session.',
        techTH: 'ทุก API call ที่ต้องการ auth จะส่ง Authorization: Bearer <jwt> ใน headers — JWT คือ Supabase access_token ที่เก็บใน browser session',
        states: { browser: 'active' },
      },
      {
        descEN: 'Frontend proxy forwards to Backend',
        descTH: 'Frontend proxy ส่งต่อไป Backend',
        techEN: 'The Next.js catch-all route /api/proxy/[...path] forwards the request to Backend, preserving the Authorization header. Token never touches the network edge — proxied server-side.',
        techTH: 'Next.js catch-all route /api/proxy/[...path] ส่งต่อ request ไป Backend พร้อม Authorization header — token ไม่ออก network edge',
        states: { browser: 'ok', frontend: 'active' },
      },
      {
        descEN: 'AuthGuard intercepts the request',
        descTH: 'AuthGuard รับ request',
        techEN: 'NestJS AuthGuard is a class-level guard on all protected controllers. It extracts the Bearer token from the Authorization header and prepares to verify it.',
        techTH: 'NestJS AuthGuard เป็น guard ระดับ class บน controller ที่ต้องการ auth — ดึง Bearer token จาก Authorization header',
        states: { browser: 'ok', frontend: 'ok', guard: 'active' },
      },
      {
        descEN: 'AuthGuard verifies JWT with Supabase',
        descTH: 'AuthGuard ตรวจ JWT กับ Supabase',
        techEN: 'Guard calls Supabase\'s getUser() with the token. Supabase verifies the JWT signature using its public key — no secret is needed on the Backend side.',
        techTH: 'Guard เรียก Supabase getUser() พร้อม token → Supabase verify JWT signature ด้วย public key — Backend ไม่ต้องเก็บ secret',
        states: { browser: 'ok', frontend: 'ok', guard: 'ok', supabase: 'active' },
      },
      {
        descEN: 'Valid JWT — request reaches Controller',
        descTH: 'JWT valid — request ถึง Controller',
        techEN: 'Supabase confirms the token is valid and returns the user object. AuthGuard attaches req.user and lets the request proceed to the controller handler.',
        techTH: 'Supabase ยืนยัน token valid → AuthGuard attach req.user → request ผ่านไปยัง controller handler ได้',
        states: { browser: 'ok', frontend: 'ok', guard: 'ok', supabase: 'ok', controller: 'ok' },
      },
    ],
  },
  {
    id: 'auth-refresh',
    labelEN: 'Token Refresh (auto-managed)',
    labelTH: 'Token Refresh',
    badge: 'RF',
    layout: 'linear',
    nodes: REFRESH_NODES,
    steps: [
      {
        descEN: 'Access token approaching expiry',
        descTH: 'Access token ใกล้หมดอายุ',
        techEN: 'Supabase JWTs expire after 1 hour by default. The supabase-js client monitors the expiry timestamp and triggers refresh automatically when <60 seconds remain.',
        techTH: 'Supabase JWT หมดอายุหลัง 1 ชั่วโมง supabase-js client ติดตาม expiry timestamp และ trigger refresh อัตโนมัติเมื่อเหลือ <60 วินาที',
        states: { browser: 'active' },
      },
      {
        descEN: 'Supabase client triggers auto-refresh',
        descTH: 'Supabase Client trigger auto-refresh',
        techEN: 'The client-side supabase-js detects the upcoming expiry and calls the token refresh endpoint in the background — no user interaction needed.',
        techTH: 'supabase-js ฝั่ง client detect expiry ที่กำลังจะมาถึง → เรียก refresh endpoint ใน background ไม่ต้องให้ผู้ใช้ทำอะไร',
        states: { browser: 'ok', client: 'active' },
      },
      {
        descEN: 'Client sends refresh_token to Supabase',
        descTH: 'Client ส่ง refresh_token → Supabase',
        techEN: 'Client POSTs the refresh_token to Supabase Auth\'s /token?grant_type=refresh_token endpoint. The refresh token is long-lived and stored securely.',
        techTH: 'Client POST refresh_token ไปยัง Supabase Auth /token?grant_type=refresh_token — refresh token เก็บอย่างปลอดภัยและมีอายุยาว',
        states: { browser: 'ok', client: 'ok', supabase: 'active' },
      },
      {
        descEN: 'Supabase issues new token pair',
        descTH: 'Supabase ออก token pair ใหม่',
        techEN: 'Supabase validates the refresh_token, rotates it (old one invalidated), and issues a new access_token + refresh_token pair. Token rotation prevents replay attacks.',
        techTH: 'Supabase validate refresh_token → rotate (token เก่าถูก invalidate) → ออก access_token + refresh_token ใหม่ — token rotation ป้องกัน replay attack',
        states: { browser: 'ok', client: 'active', supabase: 'ok' },
      },
      {
        descEN: 'Client updates session — seamlessly continues',
        descTH: 'Client update session — ต่อเนื่องไม่สะดุด',
        techEN: 'The new tokens are stored in the browser. onAuthStateChange fires with the updated session. All subsequent API calls use the new access_token — user sees nothing.',
        techTH: 'tokens ใหม่ถูกเก็บใน browser → onAuthStateChange fire ด้วย session ใหม่ → API calls ต่อไปใช้ access_token ใหม่ — ผู้ใช้ไม่รู้สึกอะไร',
        states: { browser: 'ok', client: 'ok', supabase: 'ok' },
      },
    ],
  },
];
