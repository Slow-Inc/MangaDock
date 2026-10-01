# Security & Settings Page Design

**Date:** 2026-07-21  
**Approach:** Risk-ranked incremental (C) — เพิ่มทีละ layer ตาม impact จริง  
**Scope:** Frontend `/settings` page + security features รอบด้าน

---

## 1. Architecture — `/settings` page (แทน AccountModal)

สร้าง `/settings` เป็น dedicated page แทนการขยาย modal ที่รับ complexity ไม่ไหว  
`AccountModal` เหลือแค่ quick-entry ที่ link ไป `/settings`

```
/settings                   ← layout + sidebar nav
├── /settings/profile       ← ย้ายมาจาก ProfileTab
├── /settings/password      ← ย้ายมาจาก PasswordTab
├── /settings/accounts      ← ย้ายมาจาก AccountsTab
├── /settings/security      ← ใหม่ (2FA, sessions, activity log)
└── /settings/danger        ← ย้ายมาจาก DangerTab
```

**Layout:** sidebar ซ้าย (nav links) + content area ขวา  
**Auth guard:** `SupabaseGuard` ครอบทั้ง `/settings` — redirect ไป login ถ้าไม่ได้ auth

---

## 2. Re-auth before sensitive actions

**หลักการ:** ก่อน action ที่ย้อนกลับไม่ได้หรือกระทบ credential ต้องยืนยันตัวตนก่อน  
**ข้ามไปก่อน:** Wallet topup (ใช้ simulate ต่อไป)

| Action | หน้า |
|--------|------|
| ลบบัญชี | `/settings/danger` |
| เปลี่ยน email / password | `/settings/password` |
| ปิด 2FA | `/settings/security` |
| Admin: ban user / ลบ content | `/admin/*` |

**Flow:**
- Email/password users → กรอก password ใน `ReauthModal`
- Social OAuth users → re-trigger OAuth popup (`supabase.auth.reauthenticate()`)
- Token valid 5 นาที — ทำ action ซ้ำในช่วงนั้นไม่ต้อง re-auth อีก

**New files:**
- `Frontend/app/components/ReauthModal.tsx`
- `Frontend/app/hooks/useReauth.ts` — export `withReauth(fn)` wrapper

**Modified files:**
- `Frontend/app/settings/danger/page.tsx`
- `Frontend/app/settings/password/page.tsx`
- `Frontend/app/settings/security/page.tsx` (ปิด 2FA)
- Admin action handlers

---

## 3. 2FA — TOTP 6-digit

ใช้ Supabase MFA API (`supabase.auth.mfa.*`) — รองรับ email/password users เท่านั้น  
Social OAuth users มี provider-level 2FA อยู่แล้ว

### Enrollment flow (`/settings/security`)

1. Toggle "เปิดใช้งาน 2FA" → re-auth ก่อน (section 2)
2. `mfa.enroll()` → แสดง QR code + secret สำหรับ Authenticator app
3. User สแกน → กรอก 6 หลักเพื่อยืนยัน → `mfa.challenge()` + `mfa.verify()`
4. แสดง **backup codes** (8 codes, one-time use) → ต้องกดยืนยันบันทึกก่อน activate
5. 2FA เปิดแล้ว — toggle เปลี่ยนเป็น "ปิดใช้งาน 2FA"

### Login flow (เมื่อ 2FA เปิดอยู่)

1. กรอก email + password ตามปกติ
2. Supabase ส่ง session state `mfa_required`
3. `AuthContext` detect state → redirect ไป `MfaVerifyScreen`
4. กรอก 6 หลัก → `mfa.challenge()` + `mfa.verify()` → login สำเร็จ
5. กรณีกรอก backup code: ปุ่ม "ใช้ backup code แทน" ใน `MfaVerifyScreen`

### Unenroll flow

1. กด "ปิด 2FA" ใน `/settings/security`
2. Re-auth (section 2) + กรอก 6 หลักปัจจุบัน
3. `mfa.unenroll()` → 2FA ปิดแล้ว

**New files:**
- `Frontend/app/settings/security/TotpSetupModal.tsx`
- `Frontend/app/components/MfaVerifyScreen.tsx`

**Modified files:**
- `Frontend/app/contexts/AuthContext.tsx` — handle `mfa_required` state
- `Frontend/app/auth/callback/page.tsx` — handle MFA redirect
- `Frontend/app/settings/security/page.tsx` — 2FA toggle + status

---

## 4. Login notifications (new device alert)

ใช้ HWID ที่มีอยู่แล้ว — ถ้า HWID ใหม่ที่ไม่เคยเห็นมาก่อน:
- Backend ส่ง email "มีการเข้าสู่ระบบจากอุปกรณ์ใหม่ — ถ้าไม่ใช่คุณ เปลี่ยนรหัสผ่านทันที"
- Frontend แสดง toast แจ้งเตือน

**Backend changes:**
- `HardwareIdMiddleware` — เพิ่ม lookup ใน `user_known_devices` table
- `UsersService.sendLoginAlert()` — ส่ง email ผ่าน Supabase email
- Supabase migration: table `user_known_devices (uid, hwid, first_seen, last_seen)`

**Frontend changes:**
- `AuthContext` — อ่าน flag `new_device` จาก auth response → แสดง toast

---

## 5. Session management

ใน `/settings/security` — section "อุปกรณ์ที่เข้าสู่ระบบ":
- แสดง active sessions: อุปกรณ์ (user-agent parsed), เวลาล่าสุด, HWID (truncated)
- ปุ่ม "ออกจากระบบอุปกรณ์นี้" per session
- ปุ่ม "ออกจากระบบทุกอุปกรณ์อื่น" (nuclear option)

**API:**
- `supabase.auth.signOut({ scope: 'others' })` — logout ทุกอุปกรณ์ยกเว้นปัจจุบัน
- Sessions ดึงจาก `user_known_devices` table (section 4)

**New files:**
- `Frontend/app/settings/security/SessionList.tsx`

---

## 6. Security activity log (user-facing)

ใน `/settings/security` — section "ประวัติการเข้าสู่ระบบ":
- แสดง 10 login ล่าสุด: เวลา, อุปกรณ์, สถานะ (สำเร็จ / ถูก block)
- ดึงจาก `user_known_devices` table (last_seen + first_seen per HWID)

**New files:**
- `Frontend/app/settings/security/ActivityLog.tsx`

---

## 7. Admin audit log

**Backend:** table `audit_logs (id, actor_uid, action, target_type, target_id, ip, created_at)`  
Log ทุก: ban user, ลบ post, เปลี่ยน role, approve/reject content

**Frontend:** `/admin/audit` page ใหม่
- Filter: action type, actor, วันที่
- Export CSV (optional, later)

**New files:**
- `Frontend/app/admin/audit/page.tsx`

**Modified files:**
- `Backend/src/admin/admin.service.ts` — เพิ่ม audit log calls
- Supabase migration: table `audit_logs`

---

## 8. AccountModal — simplified

เหลือแค่ quick-entry:
- แสดงชื่อ + avatar
- ปุ่ม "การตั้งค่าบัญชี" → link ไป `/settings`
- ปุ่ม "ออกจากระบบ"

ลบ tabs ออกทั้งหมด (ย้ายไป `/settings` แล้ว)

---

## Implementation order (ตาม risk-rank)

| ลำดับ | Feature | เหตุผล |
|-------|---------|--------|
| 1 | `/settings` page + migrate tabs | foundation ทุก feature ต้องใช้ |
| 2 | Re-auth (DangerTab, PasswordTab) | ปกป้อง action ที่ risk สูง ทำเร็วสุด |
| 3 | 2FA TOTP | account takeover protection |
| 4 | Login notifications | new device alert |
| 5 | Session management | remote logout |
| 6 | Security activity log | visibility |
| 7 | Admin audit log | privilege tracking |

---

## Files summary

**New Frontend files:**
- `app/settings/layout.tsx`
- `app/settings/page.tsx` (redirect → /settings/profile)
- `app/settings/profile/page.tsx`
- `app/settings/password/page.tsx`
- `app/settings/accounts/page.tsx`
- `app/settings/security/page.tsx`
- `app/settings/danger/page.tsx`
- `app/settings/security/TotpSetupModal.tsx`
- `app/settings/security/SessionList.tsx`
- `app/settings/security/ActivityLog.tsx`
- `app/components/ReauthModal.tsx`
- `app/components/MfaVerifyScreen.tsx`
- `app/hooks/useReauth.ts`
- `app/admin/audit/page.tsx`

**Modified Frontend files:**
- `app/components/AccountModal.tsx` (simplify)
- `app/components/NavbarActions.tsx` (link to /settings)
- `app/contexts/AuthContext.tsx` (mfa_required state)
- `app/auth/callback/page.tsx` (MFA redirect)

**Backend changes:**
- `HardwareIdMiddleware` — new device detection
- `UsersService` — sendLoginAlert
- `AdminService` — audit log calls
- Supabase migrations: `user_known_devices`, `audit_logs`
