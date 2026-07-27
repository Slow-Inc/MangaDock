# Security & Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง `/settings` page แทน AccountModal + feature ความปลอดภัยครบ (Re-auth, 2FA TOTP, new-device alert, session mgmt, admin audit log)

**Architecture:** `/settings/*` pages แต่ละหน้า reuse tab components เดิม + layout sidebar ซ้าย; `ReauthModal` + `useReauth` hook ห่อ sensitive actions; 2FA ผ่าน Supabase MFA API; backend เพิ่ม new-device detection บน HardwareIdMiddleware

**Tech Stack:** Next.js 15 App Router, Supabase Auth MFA (`supabase.auth.mfa.*`), NestJS (Backend), Supabase MCP (`apply_migration`), Tailwind CSS dark glass-morphism pattern

## Global Constraints

- UI สีเดิม: `bg-[#141414]` body, `bg-white/10` card, `border-white/10`, `rounded-2xl`, `backdrop-blur-2xl`
- สีอันตราย: `border-red-500/20`, `bg-red-500/5`, `text-red-300`
- Font: `text-sm` body, `text-xs` sub-text, `font-semibold` headings
- Auth guard: ทุก `/settings/*` ต้อง redirect ไป `/` ถ้าไม่ได้ login
- ภาษาไทยในทุก label/placeholder/message
- `supabase` client import จาก `../../lib/supabase` (relative to app/)
- `useAuth()` import จาก `../../contexts/AuthContext`

**Parallel execution plan:**
- Round 1 (parallel): **Task 1** + **Task 2**
- Round 2: **Task 3** (ต้องได้ Task 1 ก่อน)
- Round 3: **Task 4** (ต้องได้ Task 3 ก่อน)
- Round 4 (parallel): **Task 5** + **Task 6**

---

### Task 1: `/settings` layout + migrate existing tabs + update NavbarActions

**Files:**
- Create: `Frontend/app/settings/layout.tsx`
- Create: `Frontend/app/settings/page.tsx`
- Create: `Frontend/app/settings/profile/page.tsx`
- Create: `Frontend/app/settings/password/page.tsx`
- Create: `Frontend/app/settings/accounts/page.tsx`
- Create: `Frontend/app/settings/danger/page.tsx`
- Modify: `Frontend/app/components/NavbarActions.tsx`
- Modify: `Frontend/app/account/page.tsx`

**Interfaces:**
- Produces: `/settings/*` routes accessible, NavbarActions "จัดการบัญชี" → `/settings`

- [ ] **Step 1: สร้าง settings layout**

```tsx
// Frontend/app/settings/layout.tsx
"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

const NAV = [
  { href: "/settings/profile",  label: "ข้อมูลส่วนตัว" },
  { href: "/settings/password", label: "รหัสผ่าน" },
  { href: "/settings/accounts", label: "การเชื่อมต่อ" },
  { href: "/settings/security", label: "ความปลอดภัย" },
  { href: "/settings/danger",   label: "โซนอันตราย", danger: true },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="min-h-dvh bg-[#141414] pb-20">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-lg font-bold text-white">การตั้งค่า</h1>
        <div className="flex gap-6">
          <aside className="hidden w-48 shrink-0 md:block">
            <nav className="space-y-0.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    pathname === item.href
                      ? item.danger ? "bg-red-500/15 text-red-300" : "bg-white/10 text-white"
                      : item.danger ? "text-red-400/60 hover:bg-red-500/8 hover:text-red-300" : "text-white/50 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: สร้าง settings/page.tsx (redirect)**

```tsx
// Frontend/app/settings/page.tsx
import { redirect } from "next/navigation";
export default function SettingsPage() {
  redirect("/settings/profile");
}
```

- [ ] **Step 3: สร้าง settings/profile/page.tsx**

```tsx
// Frontend/app/settings/profile/page.tsx
"use client";
import { useReducer } from "react";
import ProfileTab from "../../components/account/ProfileTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function ProfileSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">ข้อมูลส่วนตัว</h2>
        <p className="mt-1 text-xs text-white/40">แก้ไขชื่อผู้ใช้และรูปโปรไฟล์</p>
      </div>
      <ProfileTab formState={formState} dispatch={dispatch} isOpen={true} />
    </div>
  );
}
```

- [ ] **Step 4: สร้าง settings/password/page.tsx**

```tsx
// Frontend/app/settings/password/page.tsx
"use client";
import { useReducer } from "react";
import PasswordTab from "../../components/account/PasswordTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function PasswordSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">รหัสผ่าน</h2>
        <p className="mt-1 text-xs text-white/40">เปลี่ยนรหัสผ่านบัญชีของคุณ</p>
      </div>
      <PasswordTab formState={formState} dispatch={dispatch} />
    </div>
  );
}
```

- [ ] **Step 5: สร้าง settings/accounts/page.tsx**

```tsx
// Frontend/app/settings/accounts/page.tsx
"use client";
import { useReducer, useCallback } from "react";
import { useRouter } from "next/navigation";
import AccountsTab from "../../components/account/AccountsTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function AccountsSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const router = useRouter();
  const handleTabChange = useCallback((tab: string) => router.push(`/settings/${tab}`), [router]);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">การเชื่อมต่อ</h2>
        <p className="mt-1 text-xs text-white/40">เชื่อมต่อ Google และ Facebook</p>
      </div>
      <AccountsTab formState={formState} dispatch={dispatch} onTabChange={handleTabChange} onClose={() => router.push("/")} />
    </div>
  );
}
```

- [ ] **Step 6: สร้าง settings/danger/page.tsx**

```tsx
// Frontend/app/settings/danger/page.tsx
"use client";
import { useReducer } from "react";
import { useRouter } from "next/navigation";
import DangerTab from "../../components/account/DangerTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function DangerSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const router = useRouter();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-red-300">โซนอันตราย</h2>
        <p className="mt-1 text-xs text-white/40">ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร</p>
      </div>
      <DangerTab formState={formState} dispatch={dispatch} onClose={() => router.push("/")} />
    </div>
  );
}
```

- [ ] **Step 7: อัปเดต NavbarActions — "จัดการบัญชี" → /settings**

ใน `Frontend/app/components/NavbarActions.tsx` เปลี่ยนปุ่ม "จัดการบัญชี":
```tsx
// เปลี่ยนจาก:
onClick={() => { setMenuOpen(false); setIsAccountOpen(true); }}
// เป็น:
onClick={() => { setMenuOpen(false); router.push("/settings"); }}
```

ลบ state ที่ไม่ใช้แล้ว:
```tsx
// ลบบรรทัดเหล่านี้ออก:
const [isAccountOpen, setIsAccountOpen] = useState(false);
const [accountInitialTab, setAccountInitialTab] = useState<string | undefined>(undefined);
const handleAccountClose = useCallback(() => setIsAccountOpen(false), []);
```

ลบ event listener `mb:open-account-modal` และ `AccountModal` JSX:
```tsx
// ลบ useEffect ที่ listen "mb:open-account-modal" ออก (ทั้ง block)
// ลบ <AccountModal ...> ออกจาก return JSX
// ลบ import AccountModal from "./AccountModal";
```

- [ ] **Step 8: อัปเดต account/page.tsx → redirect ไป /settings**

```tsx
// Frontend/app/account/page.tsx  (แทนที่ทั้งไฟล์)
import { redirect } from "next/navigation";
export default function AccountPage() {
  redirect("/settings");
}
```

- [ ] **Step 9: รัน lint**

```bash
cd Frontend && bun lint
```
Expected: ผ่านไม่มี error (อาจมี warning unused import จาก AccountModal — แก้ไขถ้ามี)

- [ ] **Step 10: Commit**

```bash
git add Frontend/app/settings/ Frontend/app/components/NavbarActions.tsx Frontend/app/account/page.tsx
git commit -m "feat(settings): add /settings page + migrate tabs from AccountModal"
```

---

### Task 2: Supabase migrations + Backend new-device detection + audit log service

**Files:**
- Supabase migration: `user_known_devices` table
- Supabase migration: `audit_logs` table
- Modify: `Backend/src/` — HardwareIdMiddleware (ค้นหา class `HardwareIdMiddleware`)
- Modify: `Backend/src/users/users.service.ts` — เพิ่ม `recordDevice()` + `sendLoginAlert()`
- Modify: `Backend/src/admin/admin.service.ts` — เพิ่ม `logAudit()`

**Risk (security):** DB migration เพิ่ม 2 table ใหม่ ไม่กระทบ table เดิม — rollback: `DROP TABLE user_known_devices; DROP TABLE audit_logs;`

**Interfaces:**
- Produces: `user_known_devices(uid, hwid, user_agent, first_seen, last_seen)`, `audit_logs(actor_uid, action, target_type, target_id, ip, metadata, created_at)`
- Produces: `UsersService.recordDevice(uid, hwid, userAgent): Promise<boolean>` (returns true = new device)
- Produces: `AdminService.logAudit(actorUid, action, targetType?, targetId?, ip?, metadata?)`

- [ ] **Step 1: Apply Supabase migration — user_known_devices**

ใช้ Supabase MCP `apply_migration` กับ SQL นี้:
```sql
CREATE TABLE IF NOT EXISTS public.user_known_devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hwid        TEXT NOT NULL,
  user_agent  TEXT,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (uid, hwid)
);
ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_devices" ON public.user_known_devices
  FOR ALL USING (auth.uid() = uid);
CREATE INDEX idx_known_devices_uid ON public.user_known_devices (uid);
```

- [ ] **Step 2: Apply Supabase migration — audit_logs**

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uid   UUID NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  ip          TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- เฉพาะ service_role (Backend) เท่านั้นที่ write ได้; Frontend ไม่ได้ direct access
```

- [ ] **Step 3: เพิ่ม recordDevice + sendLoginAlert ใน UsersService**

ค้นหาไฟล์: `Backend/src/users/users.service.ts`

เพิ่ม method (inject `SupabaseService` ที่มีอยู่แล้ว):
```typescript
/** บันทึก device และ return true ถ้าเป็น device ใหม่ */
async recordDevice(uid: string, hwid: string, userAgent: string): Promise<boolean> {
  const supabase = this.supabaseService.getClient();
  const { data: existing } = await supabase
    .from('user_known_devices')
    .select('id')
    .eq('uid', uid)
    .eq('hwid', hwid)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_known_devices')
      .update({ last_seen: new Date().toISOString(), user_agent: userAgent })
      .eq('uid', uid)
      .eq('hwid', hwid);
    return false; // ไม่ใช่ device ใหม่
  }

  await supabase.from('user_known_devices').insert({
    uid,
    hwid,
    user_agent: userAgent,
  });
  return true; // device ใหม่
}

async getKnownDevices(uid: string) {
  const supabase = this.supabaseService.getClient();
  const { data } = await supabase
    .from('user_known_devices')
    .select('id, hwid, user_agent, first_seen, last_seen')
    .eq('uid', uid)
    .order('last_seen', { ascending: false })
    .limit(10);
  return data ?? [];
}
```

- [ ] **Step 4: wire recordDevice ใน HardwareIdMiddleware**

ค้นหา class `HardwareIdMiddleware` ใน Backend/src/ (น่าจะอยู่ใน `common/` หรือ `auth/`)

ใน `use(req, res, next)` method หลังจาก validate uid สำเร็จ ให้เพิ่ม:
```typescript
// ตรงที่ดึง uid + hwid ได้แล้ว — เพิ่มก่อน next()
const userAgent = req.headers['user-agent'] ?? 'unknown';
const isNew = await this.usersService.recordDevice(uid, hwid, userAgent);
if (isNew) {
  res.setHeader('X-New-Device', '1');
  // Fire-and-forget email alert (ไม่ block request)
  this.usersService.sendLoginAlertEmail(uid).catch(() => {});
}
next();
```

เพิ่ม method `sendLoginAlertEmail` ใน UsersService:
```typescript
async sendLoginAlertEmail(uid: string): Promise<void> {
  const supabase = this.supabaseService.getClient();
  const { data: { user } } = await supabase.auth.admin.getUserById(uid);
  if (!user?.email) return;
  // ใช้ Supabase Admin email หรือ backend email service ที่มีอยู่
  // ถ้ายังไม่มี email service ให้ log warning และ skip
  this.logger.warn(`[LoginAlert] new device for ${user.email} — email not sent (no email service configured)`);
}
```

- [ ] **Step 5: เพิ่ม logAudit ใน AdminService**

ค้นหา `Backend/src/admin/admin.service.ts` เพิ่ม method:
```typescript
async logAudit(
  actorUid: string,
  action: string,
  targetType?: string,
  targetId?: string,
  ip?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const supabase = this.supabaseService.getClient();
  await supabase.from('audit_logs').insert({
    actor_uid: actorUid,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    ip: ip ?? null,
    metadata: metadata ?? null,
  });
}
```

เรียก `logAudit` ใน admin controller methods ที่ sensitive (ban user, delete content, change role):
```typescript
// ตัวอย่าง ใน admin controller — หลัง action สำเร็จ:
await this.adminService.logAudit(actorUid, 'ban_user', 'user', targetUserId, req.ip);
```

- [ ] **Step 6: รัน backend unit tests ที่เกี่ยวข้อง**

```bash
cd Backend && npx jest src/users/ src/admin/ --no-coverage
```
Expected: tests ผ่าน (pre-existing failures ใน books/pubsub suite ไม่เกี่ยว)

- [ ] **Step 7: Commit**

```bash
git add Backend/src/users/ Backend/src/admin/ Backend/src/common/
git commit -m "feat(security): add user_known_devices + audit_logs + new-device detection"
```

---

### Task 3: `ReauthModal` component + `useReauth` hook

**Files:**
- Create: `Frontend/app/components/ReauthModal.tsx`
- Create: `Frontend/app/hooks/useReauth.ts`

**Interfaces:**
- Produces: `useReauth()` → `{ withReauth, ReauthModalNode }`
- `withReauth(fn: () => Promise<void>): () => Promise<void>` — wraps fn ด้วย reauth gate (5-min window)
- `ReauthModalNode` — JSX ที่ต้อง render ในหน้าที่ใช้ hook

- [ ] **Step 1: สร้าง ReauthModal**

```tsx
// Frontend/app/components/ReauthModal.tsx
"use client";
import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { errMessage } from "@/lib/errMessage";

interface ReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionLabel?: string;
}

export default function ReauthModal({ isOpen, onClose, onSuccess, actionLabel = "ดำเนินการต่อ" }: ReauthModalProps) {
  const { user, reauthenticateUser } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"password" | "google" | "facebook" | null>(null);
  const resolvedRef = useRef(false);

  const hasPassword = user?.providerData.some(p => p.providerId === "password");
  const hasGoogle   = user?.providerData.some(p => p.providerId === "google.com");
  const hasFacebook = user?.providerData.some(p => p.providerId === "facebook.com");

  const handlePassword = async () => {
    if (!password) return;
    setLoading("password"); setError(null);
    try {
      await reauthenticateUser("password", password);
      onSuccess();
      setPassword("");
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(code === "auth/wrong-password" ? "รหัสผ่านไม่ถูกต้อง" : errMessage(e) || "เกิดข้อผิดพลาด");
    } finally { setLoading(null); }
  };

  const handleOAuth = (provider: "google" | "facebook") => async () => {
    setLoading(provider); setError(null); resolvedRef.current = false;
    const onFocus = () => setTimeout(() => { if (!resolvedRef.current) setLoading(null); }, 2000);
    window.addEventListener("focus", onFocus, { once: true });
    try {
      await reauthenticateUser(provider);
      resolvedRef.current = true;
      onSuccess();
    } catch (e) {
      resolvedRef.current = true;
      const code = (e as { code?: string })?.code ?? "";
      if (!code.includes("popup-closed") && !code.includes("cancelled")) {
        setError(errMessage(e) || "เกิดข้อผิดพลาด");
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl">
        <p className="text-sm font-semibold text-white">ยืนยันตัวตน</p>
        <p className="mt-1 text-xs text-white/50">เพื่อความปลอดภัยก่อน{actionLabel} กรุณายืนยันว่าเป็นคุณ</p>

        {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</div>}

        <div className="mt-4 space-y-2">
          {hasPassword && (
            <>
              <input
                type="password" value={password} onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="รหัสผ่านของคุณ" autoFocus
                onKeyDown={e => e.key === "Enter" && handlePassword()}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
              />
              <button onClick={handlePassword} disabled={!password || !!loading}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50">
                {loading === "password" ? "กำลังยืนยัน…" : "ยืนยันด้วยรหัสผ่าน"}
              </button>
            </>
          )}
          {hasPassword && (hasGoogle || hasFacebook) && (
            <div className="flex items-center gap-2"><span className="h-px flex-1 bg-white/10"/><span className="text-[10px] text-white/30">หรือ</span><span className="h-px flex-1 bg-white/10"/></div>
          )}
          {hasGoogle && (
            <button onClick={handleOAuth("google")} disabled={!!loading}
              className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50">
              {loading === "google" ? "กำลังยืนยัน…" : "ยืนยันด้วย Google"}
            </button>
          )}
          {hasFacebook && (
            <button onClick={handleOAuth("facebook")} disabled={!!loading}
              className="w-full rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 py-2.5 text-sm font-semibold text-[#74a9f5] transition hover:bg-[#1877F2]/20 disabled:opacity-50">
              {loading === "facebook" ? "กำลังยืนยัน…" : "ยืนยันด้วย Facebook"}
            </button>
          )}
          <button onClick={() => { onClose(); setPassword(""); setError(null); }}
            className="w-full rounded-xl border border-white/10 py-2 text-xs text-white/40 transition hover:bg-white/5 hover:text-white/60">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: สร้าง useReauth hook**

```typescript
// Frontend/app/hooks/useReauth.ts
"use client";
import { useCallback, useRef, useState } from "react";
import ReauthModal from "../components/ReauthModal";
import React from "react";

const REAUTH_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useReauth(actionLabel?: string) {
  const [showModal, setShowModal] = useState(false);
  const [reauthTs, setReauthTs] = useState(0);
  const pendingRef = useRef<(() => Promise<void>) | null>(null);

  const withReauth = useCallback(
    (fn: () => Promise<void>) =>
      async () => {
        if (Date.now() - reauthTs < REAUTH_TTL_MS) {
          await fn();
          return;
        }
        pendingRef.current = fn;
        setShowModal(true);
      },
    [reauthTs],
  );

  const handleSuccess = useCallback(async () => {
    setReauthTs(Date.now());
    setShowModal(false);
    const fn = pendingRef.current;
    pendingRef.current = null;
    if (fn) await fn();
  }, []);

  const ReauthModalNode = React.createElement(ReauthModal, {
    isOpen: showModal,
    onClose: () => { setShowModal(false); pendingRef.current = null; },
    onSuccess: handleSuccess,
    actionLabel,
  });

  return { withReauth, ReauthModalNode };
}
```

- [ ] **Step 3: Commit**

```bash
git add Frontend/app/components/ReauthModal.tsx Frontend/app/hooks/useReauth.ts
git commit -m "feat(security): add ReauthModal + useReauth hook"
```

---

### Task 4: 2FA — AuthContext additions + TotpSetupModal + MfaVerifyScreen

**Files:**
- Modify: `Frontend/app/contexts/AuthContext.tsx`
- Create: `Frontend/app/settings/security/TotpSetupModal.tsx`
- Create: `Frontend/app/components/MfaVerifyScreen.tsx`

**Interfaces:**
- Produces in AuthContext: `enrollTotp()`, `verifyTotpEnrollment(factorId, code)`, `unenrollTotp(factorId)`, `getActiveTotpFactor()`, `checkAndHandleMfa()` (returns true ถ้าต้อง MFA), `verifyTotpForLogin(factorId, code)`
- Produces: `mfaRequired: boolean`, `setMfaRequired`

- [ ] **Step 1: เพิ่ม MFA types ใน AuthContext**

ใน `AuthContextType` (ประมาณ line 137) เพิ่ม:
```typescript
enrollTotp: () => Promise<{ qr_code: string; secret: string; factorId: string }>;
verifyTotpEnrollment: (factorId: string, code: string) => Promise<void>;
unenrollTotp: (factorId: string) => Promise<void>;
getActiveTotpFactor: () => Promise<{ id: string; friendly_name: string } | null>;
verifyTotpForLogin: (factorId: string, code: string) => Promise<void>;
mfaRequired: boolean;
pendingMfaFactorId: string | null;
```

เพิ่ม default values ใน `createContext({...})`:
```typescript
enrollTotp: async () => ({ qr_code: "", secret: "", factorId: "" }),
verifyTotpEnrollment: async () => {},
unenrollTotp: async () => {},
getActiveTotpFactor: async () => null,
verifyTotpForLogin: async () => {},
mfaRequired: false,
pendingMfaFactorId: null,
```

- [ ] **Step 2: เพิ่ม MFA state + functions ใน AuthProvider**

ใน `AuthProvider` function ใต้ `const [loading, setLoading] = useState(true);` เพิ่ม:
```typescript
const [mfaRequired, setMfaRequired] = useState(false);
const [pendingMfaFactorId, setPendingMfaFactorId] = useState<string | null>(null);
```

เพิ่ม functions (ก่อน `return` ของ AuthProvider):
```typescript
const enrollTotp = async () => {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'MangaDock Authenticator',
  });
  if (error) throw error;
  return {
    qr_code: data.totp.qr_code,
    secret: data.totp.secret,
    factorId: data.id,
  };
};

const verifyTotpEnrollment = async (factorId: string, code: string) => {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) throw Object.assign(error, { code: 'auth/invalid-totp-code' });
};

const unenrollTotp = async (factorId: string) => {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
};

const getActiveTotpFactor = async () => {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return null;
  const verified = data.totp.find(f => f.status === 'verified');
  return verified ? { id: verified.id, friendly_name: verified.friendly_name ?? 'Authenticator' } : null;
};

const verifyTotpForLogin = async (factorId: string, code: string) => {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) throw Object.assign(new Error('รหัสไม่ถูกต้อง'), { code: 'auth/invalid-totp-code' });
  setMfaRequired(false);
  setPendingMfaFactorId(null);
  reloadPage();
};
```

- [ ] **Step 3: แก้ signInWithEmail ให้ handle MFA**

ใน `signInWithEmail` ต่อจาก `if (error) { ... }` เพิ่มก่อน success toast:
```typescript
// Check if MFA upgrade required
const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find(f => f.status === 'verified');
  if (factor) {
    setPendingMfaFactorId(factor.id);
    setMfaRequired(true);
    return; // หยุดตรงนี้ รอ user กรอก TOTP
  }
}
```

- [ ] **Step 4: เพิ่ม values ใน useMemo**

ใน `useMemo` deps array เพิ่ม `mfaRequired, pendingMfaFactorId` และใน value object เพิ่ม:
```typescript
enrollTotp,
verifyTotpEnrollment,
unenrollTotp,
getActiveTotpFactor,
verifyTotpForLogin,
mfaRequired,
pendingMfaFactorId,
```

- [ ] **Step 5: render MfaVerifyScreen ใน AuthProvider JSX**

ใน return ของ `AuthProvider` ต่อจาก `{loginOpen && <LoginModalLazy .../>}` เพิ่ม:
```tsx
{mfaRequired && pendingMfaFactorId && (
  <MfaVerifyScreenLazy
    factorId={pendingMfaFactorId}
    onClose={() => { setMfaRequired(false); setPendingMfaFactorId(null); }}
  />
)}
```

เพิ่ม lazy loader ด้านล่าง (เหมือน LoginModalLazy):
```typescript
function MfaVerifyScreenLazy({ factorId, onClose }: { factorId: string; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MfaVerifyScreen = require("../components/MfaVerifyScreen").default as
    (props: { factorId: string; onClose: () => void }) => React.ReactElement;
  return <MfaVerifyScreen factorId={factorId} onClose={onClose} />;
}
```

- [ ] **Step 6: สร้าง MfaVerifyScreen**

```tsx
// Frontend/app/components/MfaVerifyScreen.tsx
"use client";
import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function MfaVerifyScreen({ factorId, onClose }: { factorId: string; onClose: () => void }) {
  const { verifyTotpForLogin } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true); setError(null);
    try {
      await verifyTotpForLogin(factorId, code);
    } catch {
      setError("รหัสไม่ถูกต้อง กรุณาลองใหม่");
      setCode("");
      inputRef.current?.focus();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/20">
          <svg className="h-7 w-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-white">การยืนยันสองขั้นตอน</p>
        <p className="mt-1 text-xs text-white/50">กรอกรหัส 6 หลักจาก Authenticator app ของคุณ</p>

        {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</div>}

        <input
          ref={inputRef}
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={code} maxLength={6} autoFocus
          onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
          onKeyDown={e => e.key === "Enter" && handleVerify()}
          placeholder="000000"
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder-white/20 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
        />

        <button onClick={handleVerify} disabled={code.length !== 6 || loading}
          className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50">
          {loading ? "กำลังยืนยัน…" : "ยืนยัน"}
        </button>
        <button onClick={onClose} className="mt-2 text-xs text-white/30 transition hover:text-white/60">
          ยกเลิกและออกจากระบบ
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: สร้าง TotpSetupModal**

```tsx
// Frontend/app/settings/security/TotpSetupModal.tsx
"use client";
import Image from "next/image";
import { useCallback, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

type Step = "scan" | "verify" | "done";

interface TotpSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}

export default function TotpSetupModal({ isOpen, onClose, onEnrolled }: TotpSetupModalProps) {
  const { enrollTotp, verifyTotpEnrollment } = useAuth();
  const [step, setStep] = useState<Step>("scan");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startEnroll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await enrollTotp();
      setQrCode(data.qr_code);
      setSecret(data.secret);
      setFactorId(data.factorId);
      setStep("scan");
    } catch (e) {
      setError("เกิดข้อผิดพลาดในการเริ่มต้น กรุณาลองใหม่");
      console.error(e);
    } finally { setLoading(false); }
  }, [enrollTotp]);

  // Start enroll when modal opens
  const handleOpen = useCallback(() => {
    setStep("scan"); setCode(""); setError(null);
    startEnroll();
  }, [startEnroll]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true); setError(null);
    try {
      await verifyTotpEnrollment(factorId, code);
      setStep("done");
    } catch {
      setError("รหัสไม่ถูกต้อง กรุณาลองใหม่");
      setCode("");
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  // Auto-start on first render
  if (!qrCode && !loading && !error) { handleOpen(); }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-white">เปิดใช้งาน 2FA</p>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.7A1 1 0 0 0 5.7 7.12L10.59 12 5.7 16.88a1 1 0 1 0 1.42 1.42L12 13.41l4.88 4.89a1 1 0 0 0 1.42-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</div>}

        {step === "scan" && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-white/50">สแกน QR code ด้วย Google Authenticator หรือ Authy</p>
            {loading ? (
              <div className="mx-auto h-40 w-40 animate-pulse rounded-xl bg-white/5" />
            ) : qrCode ? (
              <div className="mx-auto h-40 w-40 overflow-hidden rounded-xl bg-white p-2">
                <Image src={qrCode} alt="TOTP QR Code" width={144} height={144} className="h-full w-full" unoptimized />
              </div>
            ) : null}
            {secret && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] text-white/30 mb-1">หรือกรอก secret key ด้วยตนเอง</p>
                <p className="font-mono text-xs text-white/70 break-all">{secret}</p>
              </div>
            )}
            <button onClick={() => setStep("verify")} disabled={!qrCode || loading}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50">
              สแกนแล้ว ไปยืนยัน →
            </button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-3">
            <p className="text-xs text-white/50 text-center">กรอกรหัส 6 หลักจาก Authenticator app เพื่อยืนยัน</p>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={code} maxLength={6} autoFocus
              onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              placeholder="000000"
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder-white/20 outline-none transition focus:border-blue-400/50"
            />
            <button onClick={handleVerify} disabled={code.length !== 6 || loading}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50">
              {loading ? "กำลังยืนยัน…" : "ยืนยันและเปิดใช้ 2FA"}
            </button>
            <button onClick={() => setStep("scan")} className="w-full text-xs text-white/30 transition hover:text-white/60">
              ← กลับไปสแกน QR
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-7 w-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">เปิดใช้งาน 2FA สำเร็จ!</p>
            <p className="text-xs text-white/50">ทุกครั้งที่เข้าสู่ระบบด้วยรหัสผ่าน จะต้องกรอกรหัสจาก Authenticator app ด้วย</p>
            <button onClick={() => { onEnrolled(); onClose(); }}
              className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500">
              เสร็จสิ้น
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: รัน lint**

```bash
cd Frontend && bun lint
```

- [ ] **Step 9: Commit**

```bash
git add Frontend/app/contexts/AuthContext.tsx Frontend/app/components/MfaVerifyScreen.tsx Frontend/app/settings/security/TotpSetupModal.tsx
git commit -m "feat(2fa): add TOTP enrollment + login MFA verify via Supabase MFA"
```

---

### Task 5: `/settings/security` page + `/settings/security/page.tsx`

**Files:**
- Create: `Frontend/app/settings/security/page.tsx`
- Create: `Frontend/app/settings/security/SessionList.tsx`
- Create: `Frontend/app/settings/security/ActivityLog.tsx`

**Interfaces:**
- Consumes: `useReauth` (Task 3), `TotpSetupModal` (Task 4), `getActiveTotpFactor`, `unenrollTotp` (Task 4)
- Consumes: `GET /api/proxy/users/me/devices` (Backend Task 2 — `getKnownDevices`)

- [ ] **Step 1: เพิ่ม /users/me/devices endpoint ใน Backend**

ใน `Backend/src/users/users.controller.ts` เพิ่ม:
```typescript
@Get('me/devices')
@UseGuards(AuthGuard)
async getDevices(@Req() req: Request & { user: { uid: string } }) {
  return this.usersService.getKnownDevices(req.user.uid);
}
```

- [ ] **Step 2: สร้าง SessionList component**

```tsx
// Frontend/app/settings/security/SessionList.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface Device {
  id: string;
  hwid: string;
  user_agent: string | null;
  first_seen: string;
  last_seen: string;
}

function parseUA(ua: string | null): string {
  if (!ua) return "อุปกรณ์ไม่ระบุ";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iPhone/iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  return "อุปกรณ์อื่น";
}

export default function SessionList() {
  const { getIdToken } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIdToken().then(token => {
      if (!token) return;
      fetch("/api/proxy/users/me/devices", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(setDevices)
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [getIdToken]);

  if (loading) return <div className="h-20 animate-pulse rounded-xl bg-white/5" />;

  return (
    <div className="space-y-2">
      {devices.length === 0 && <p className="text-xs text-white/30">ไม่พบข้อมูลอุปกรณ์</p>}
      {devices.map(d => (
        <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{parseUA(d.user_agent)}</p>
            <p className="text-xs text-white/40">
              ล่าสุด: {new Date(d.last_seen).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: สร้าง ActivityLog component**

```tsx
// Frontend/app/settings/security/ActivityLog.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface Device {
  hwid: string;
  user_agent: string | null;
  first_seen: string;
  last_seen: string;
}

function parseUA(ua: string | null): string {
  if (!ua) return "อุปกรณ์ไม่ระบุ";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iPhone/iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Windows")) return "Windows";
  return "อุปกรณ์อื่น";
}

export default function ActivityLog() {
  const { getIdToken } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIdToken().then(token => {
      if (!token) return;
      fetch("/api/proxy/users/me/devices", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(setDevices)
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [getIdToken]);

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-white/5" />;

  return (
    <div className="space-y-1.5">
      {devices.slice(0, 10).map((d, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
          <div className="h-2 w-2 shrink-0 rounded-full bg-green-400/60" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/70">{parseUA(d.user_agent)} · เข้าสู่ระบบ</p>
            <p className="text-[11px] text-white/35">
              {new Date(d.last_seen).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
      {devices.length === 0 && <p className="text-xs text-white/30">ยังไม่มีประวัติการเข้าสู่ระบบ</p>}
    </div>
  );
}
```

- [ ] **Step 4: สร้าง settings/security/page.tsx**

```tsx
// Frontend/app/settings/security/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useReauth } from "../../hooks/useReauth";
import TotpSetupModal from "./TotpSetupModal";
import SessionList from "./SessionList";
import ActivityLog from "./ActivityLog";

export default function SecuritySettingsPage() {
  const { user, getActiveTotpFactor, unenrollTotp, signOut } = useAuth();
  const { withReauth, ReauthModalNode } = useReauth("ปิด 2FA");

  const [totpFactor, setTotpFactor] = useState<{ id: string; friendly_name: string } | null>(null);
  const [totpLoading, setTotpLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  const loadFactor = useCallback(async () => {
    setTotpLoading(true);
    const factor = await getActiveTotpFactor();
    setTotpFactor(factor);
    setTotpLoading(false);
  }, [getActiveTotpFactor]);

  useEffect(() => { loadFactor(); }, [loadFactor]);

  const handleUnenroll = withReauth(async () => {
    if (!totpFactor) return;
    await unenrollTotp(totpFactor.id);
    setTotpFactor(null);
  });

  const hasPassword = user?.providerData.some(p => p.providerId === "password");

  return (
    <div className="space-y-6">
      {ReauthModalNode}
      <TotpSetupModal isOpen={showSetup} onClose={() => setShowSetup(false)} onEnrolled={loadFactor} />

      <div>
        <h2 className="text-base font-semibold text-white">ความปลอดภัย</h2>
        <p className="mt-1 text-xs text-white/40">จัดการ 2FA อุปกรณ์ที่เข้าสู่ระบบ และประวัติกิจกรรม</p>
      </div>

      {/* 2FA Section */}
      <div className="rounded-2xl border border-white/10 bg-white/4 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">การยืนยันตัวตนสองขั้นตอน (2FA)</p>
            <p className="text-xs text-white/40 mt-0.5">
              {!hasPassword ? "ใช้ได้เฉพาะบัญชีที่มีรหัสผ่านเท่านั้น" : totpLoading ? "กำลังโหลด…" : totpFactor ? "เปิดใช้งานอยู่" : "ปิดอยู่"}
            </p>
          </div>
          {hasPassword && !totpLoading && (
            totpFactor ? (
              <button onClick={handleUnenroll}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20">
                ปิด 2FA
              </button>
            ) : (
              <button onClick={() => setShowSetup(true)}
                className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500">
                เปิด 2FA
              </button>
            )
          )}
        </div>
        {totpFactor && (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <p className="text-xs text-green-300">2FA เปิดใช้งานอยู่ — ต้องกรอกรหัส 6 หลักทุกครั้งที่ login</p>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">อุปกรณ์ที่เข้าสู่ระบบ</p>
          <button onClick={() => signOut()}
            className="text-xs text-white/40 transition hover:text-white/70">
            ออกจากระบบทุกอุปกรณ์
          </button>
        </div>
        <SessionList />
      </div>

      {/* Activity Log */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-white">ประวัติการเข้าสู่ระบบ</p>
        <ActivityLog />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: รัน lint**

```bash
cd Frontend && bun lint
```

- [ ] **Step 6: Commit**

```bash
git add Frontend/app/settings/security/
git commit -m "feat(security): add /settings/security page — 2FA toggle + session list + activity log"
```

---

### Task 6: Admin audit log page `/admin/audit`

**Files:**
- Create: `Frontend/app/admin/audit/page.tsx`
- Modify: `Backend/src/admin/admin.controller.ts` — เพิ่ม GET /admin/audit endpoint

**Interfaces:**
- Consumes: `GET /api/proxy/admin/audit?limit=50&offset=0&action=&actorUid=`
- Consumes: `audit_logs` table (Task 2)

- [ ] **Step 1: เพิ่ม audit endpoint ใน Backend admin controller**

ใน `Backend/src/admin/admin.controller.ts` เพิ่ม:
```typescript
@Get('audit')
@UseGuards(AuthGuard, AdminGuard)
async getAuditLogs(
  @Query('limit') limit = '50',
  @Query('offset') offset = '0',
  @Query('action') action?: string,
  @Query('actorUid') actorUid?: string,
) {
  return this.adminService.getAuditLogs({
    limit: Math.min(parseInt(limit, 10) || 50, 200),
    offset: parseInt(offset, 10) || 0,
    action: action || undefined,
    actorUid: actorUid || undefined,
  });
}
```

เพิ่ม method ใน `AdminService`:
```typescript
async getAuditLogs(opts: { limit: number; offset: number; action?: string; actorUid?: string }) {
  const supabase = this.supabaseService.getClient();
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (opts.action) query = query.eq('action', opts.action);
  if (opts.actorUid) query = query.eq('actor_uid', opts.actorUid);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: สร้าง /admin/audit page**

```tsx
// Frontend/app/admin/audit/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface AuditLog {
  id: string;
  actor_uid: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  ban_user: "แบนผู้ใช้",
  delete_post: "ลบโพสต์",
  change_role: "เปลี่ยน Role",
  delete_content: "ลบเนื้อหา",
};

export default function AdminAuditPage() {
  const { getIdToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIdToken().then(token => {
      if (!token) return;
      fetch("/api/proxy/admin/audit?limit=50", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(setLogs)
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [getIdToken]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white">Audit Log</h1>
        <p className="text-xs text-white/40 mt-1">บันทึกการดำเนินการของ Admin ทั้งหมด</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />)}</div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-white/30">ยังไม่มี audit log</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 font-semibold text-white/60">Action</th>
                <th className="px-4 py-3 font-semibold text-white/60">Target</th>
                <th className="px-4 py-3 font-semibold text-white/60">IP</th>
                <th className="px-4 py-3 font-semibold text-white/60">เวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-white/3 transition">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-white/8 px-2 py-0.5 font-mono text-white/70">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {log.target_type && <span className="text-white/30 mr-1">{log.target_type}/</span>}
                    {log.target_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-white/40 font-mono">{log.ip ?? "—"}</td>
                  <td className="px-4 py-3 text-white/40">
                    {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: เพิ่ม link ใน admin layout หรือ sidebar**

ค้นหา `Frontend/app/admin/layout.tsx` เพิ่ม link ไป `/admin/audit`:
```tsx
// เพิ่มใน admin nav
<Link href="/admin/audit" className="...">Audit Log</Link>
```

- [ ] **Step 4: รัน Backend tests**

```bash
cd Backend && npx jest src/admin/ --no-coverage
```

- [ ] **Step 5: รัน Frontend lint**

```bash
cd Frontend && bun lint
```

- [ ] **Step 6: Commit**

```bash
git add Frontend/app/admin/audit/ Backend/src/admin/
git commit -m "feat(admin): add /admin/audit page + GET /admin/audit endpoint"
```

---

## Manual Testing Checklist (สำหรับ user ทดสอบเอง)

### `/settings` page

- [ ] เข้า `/settings` โดยไม่ login → redirect ไป `/`
- [ ] login แล้วกด "จัดการบัญชี" ใน navbar → ไปที่ `/settings/profile`
- [ ] sidebar nav ทำงานถูกต้อง ทุก tab แสดงเนื้อหาเดิม
- [ ] บน mobile ไป URL `/settings/profile` โดยตรง → แสดงได้ถูกต้อง
- [ ] `/account` redirect ไป `/settings` ทันที

### Re-auth

- [ ] ไป `/settings/danger` → กด "ลบบัญชีของฉัน" → แสดง reauth flow ตามปกติ (ยังเป็น inline จาก DangerTab เดิม)
- [ ] ไป `/settings/password` → เปลี่ยนรหัสผ่าน → ต้องกรอก password เดิม (มีอยู่แล้วใน PasswordTab)

### 2FA

- [ ] ไป `/settings/security` → บัญชี Google-only ไม่เห็นปุ่ม 2FA
- [ ] บัญชี email/password: กด "เปิด 2FA" → เห็น `TotpSetupModal` พร้อม QR code
- [ ] สแกน QR ด้วย Google Authenticator → กรอก 6 หลัก → success message
- [ ] logout แล้ว login ด้วย email/password → เห็นหน้า `MfaVerifyScreen` 6 หลัก
- [ ] กรอกรหัสถูก → login สำเร็จ
- [ ] กรอกรหัสผิด → error message แสดง
- [ ] ใน `/settings/security` → กด "ปิด 2FA" → `ReauthModal` เปิด → ยืนยัน → 2FA ปิด

### Session & Activity

- [ ] ไป `/settings/security` → เห็น section "อุปกรณ์ที่เข้าสู่ระบบ" (อาจว่างถ้า backend ยังไม่ record)
- [ ] เข้าจาก browser ใหม่ → toast/header `X-New-Device: 1` (ตรวจ dev tools)

### Admin Audit

- [ ] login ด้วย admin account → ไป `/admin/audit` → เห็น log (อาจว่างถ้ายังไม่มี action)
- [ ] ทำ admin action (ban user) → refresh `/admin/audit` → เห็น log ใหม่
