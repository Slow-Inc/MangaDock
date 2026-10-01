# AccountModal Tab Split + Reducer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `AccountModal.tsx` (1 383 lines) into four focused tab children, hoist `loading/successMessage/errorMessage` into a `useReducer`, and remove all 3 `exhaustive-deps` suppressions — zero behaviour change.

**Architecture:** `FormState`/`FormAction`/`formReducer` live in `account/formReducer.ts`. Four tab files in `components/account/` receive `formState` + `dispatch` as props and call `useAuth()` directly for auth methods. The `<div ref={tabRef}>` wrappers stay in AccountModal; tab children render only the inner content. Photo-picker state stays in AccountModal (it's in the header, not inside any tab panel).

**Tech Stack:** React 19, TypeScript, Next.js 16, Tailwind CSS, `bun test`, `bun lint` (ESLint with `react-hooks/exhaustive-deps`)

## Global Constraints

- Zero behaviour change — same UX, same Thai strings, same CSS classes
- No new npm packages
- `bun lint` must pass with 0 `// eslint-disable-next-line react-hooks/exhaustive-deps` lines after Task 7
- `bun test` (Frontend unit tests) must pass after each task
- All files use `"use client";` directive

---

### Task 1: Stabilise foundations (AuthContext + AccountModal effects)

**Files:**
- Modify: `Frontend/app/contexts/AuthContext.tsx` (wrap `getPhotoHistory` in `useCallback`)
- Modify: `Frontend/app/components/AccountModal.tsx` (replace `tabRefs` object with `useMemo`; replace panel-height state/effect with `ResizeObserver`)

**Why:** `getPhotoHistory` (line 715 AuthContext) is a plain `async` function re-created every render. Adding it to deps without memoisation causes an infinite loop. The panel-height effect suppresses `tabRefs` because `tabRefs` is rebuilt every render; after tab extraction the effect would also need every child's local state — fix it properly with `ResizeObserver` instead.

- [ ] **Step 1: Wrap `getPhotoHistory` in `useCallback` in AuthContext**

Find `getPhotoHistory` at line ~715 in `Frontend/app/contexts/AuthContext.tsx`. Change:

```ts
// BEFORE (plain async function — re-created every render)
const getPhotoHistory = async (): Promise<string[]> => {
  if (!user) return [];
  try {
    const token = await getIdToken();
    // ... rest of implementation
  }
};
```

```ts
// AFTER (useCallback — stable reference)
const getPhotoHistory = useCallback(async (): Promise<string[]> => {
  if (!user) return [];
  try {
    const token = await getIdToken();
    // ... rest of implementation (unchanged)
  }
}, [user, getIdToken]);
```

`useCallback` must already be imported in AuthContext (it is — confirm with grep). `getIdToken` is already a stable function defined earlier in the same provider.

- [ ] **Step 2: Stabilise `tabRefs` with `useMemo` in AccountModal**

In `Frontend/app/components/AccountModal.tsx`, find the `tabRefs` object (lines 65-70):

```ts
// BEFORE
const tabRefs: Record<Tab, React.RefObject<HTMLDivElement | null>> = {
  profile: profileRef,
  password: passwordRef,
  accounts: accountsRef,
  danger: dangerRef,
};
```

```ts
// AFTER — add useMemo to imports, then:
const tabRefs = useMemo<Record<Tab, React.RefObject<HTMLDivElement | null>>>(
  () => ({ profile: profileRef, password: passwordRef, accounts: accountsRef, danger: dangerRef }),
  [] // refs are stable objects — correct to omit them
);
```

Add `useMemo` to the existing React import line.

- [ ] **Step 3: Replace panel-height effect with ResizeObserver**

Remove the current effect at lines 124-132 (the one with the exhaustive-deps suppression for `tabRefs`). Replace with:

```ts
// Measure active panel height automatically via ResizeObserver
useEffect(() => {
  if (!isOpen || !visible || asPage) return;
  const target = tabRefs[tab]?.current;
  if (!target) return;
  const observer = new ResizeObserver(entries => {
    const entry = entries[0];
    if (entry) setPanelHeight(Math.round(entry.contentRect.height));
  });
  observer.observe(target);
  setPanelHeight(target.offsetHeight);
  return () => observer.disconnect();
}, [isOpen, visible, tab, asPage, tabRefs]);
```

This fires whenever the tab panel's DOM height changes — no need to list child state in deps.

- [ ] **Step 4: Run tests and lint**

```bash
cd Frontend
bun test
bun lint
```

Expected: tests pass, lint has 2 suppressions remaining (lines 121 and 142 — fixed in later tasks).

- [ ] **Step 5: Commit**

```bash
git add Frontend/app/contexts/AuthContext.tsx Frontend/app/components/AccountModal.tsx
git commit -m "refactor(account): stabilise getPhotoHistory useCallback + tabRefs useMemo + ResizeObserver (#585)"
```

---

### Task 2: Add `formReducer` and replace 3 `useState` with `useReducer`

**Files:**
- Create: `Frontend/app/components/account/formReducer.ts`
- Modify: `Frontend/app/components/AccountModal.tsx`

**Interfaces:**
- Produces: `FormState`, `FormAction`, `formReducer` — consumed by Tasks 3-6

- [ ] **Step 1: Create `Frontend/app/components/account/formReducer.ts`**

```ts
export type FormState = {
  loading: boolean;
  successMessage: string | null;
  errorMessage: string | null;
};

export type FormAction =
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_SUCCESS"; message: string }
  | { type: "SET_ERROR"; message: string }
  | { type: "CLEAR" };

export const initialFormState: FormState = {
  loading: false,
  successMessage: null,
  errorMessage: null,
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_SUCCESS":
      return { loading: false, successMessage: action.message, errorMessage: null };
    case "SET_ERROR":
      return { loading: false, successMessage: null, errorMessage: action.message };
    case "CLEAR":
      return initialFormState;
  }
}
```

- [ ] **Step 2: Replace 3 `useState` with `useReducer` in AccountModal**

Add to imports at top of `AccountModal.tsx`:
```ts
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { formReducer, initialFormState } from "./account/formReducer";
import type { FormState, FormAction } from "./account/formReducer";
```

Remove the three state lines:
```ts
// DELETE these:
const [loading, setLoading] = useState(false);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

Add after the other `useState` lines:
```ts
const [formState, dispatch] = useReducer(formReducer, initialFormState);
const { loading, successMessage, errorMessage } = formState;
```

The destructure keeps all existing references to `loading`, `successMessage`, `errorMessage` working unchanged throughout the file.

- [ ] **Step 3: Replace `setLoading` / `setSuccessMessage` / `setErrorMessage` / `clearMessages` calls**

Replace the `clearMessages` helper:
```ts
// BEFORE
const clearMessages = () => {
  setSuccessMessage(null);
  setErrorMessage(null);
};
```
```ts
// AFTER
const clearMessages = () => dispatch({ type: "CLEAR" });
```

Replace every `setLoading(true)` → `dispatch({ type: "SET_LOADING", value: true })`
Replace every `setLoading(false)` → `dispatch({ type: "SET_LOADING", value: false })`
Replace every `setSuccessMessage("...")` → `dispatch({ type: "SET_SUCCESS", message: "..." })`
Replace every `setErrorMessage("...")` → `dispatch({ type: "SET_ERROR", message: "..." })`

Occurrences (search with grep to confirm):
- `handleUpdateProfile` (lines ~222-233): 2 × setLoading, 1 × setSuccessMessage, 1 × setErrorMessage
- `handlePasswordReauthForDelete` (lines ~236-256): 3 × setErrorMessage
- `withDeleteReauthPopupGuard` (lines ~262-297): 2 × setErrorMessage
- `handleDeleteAccount` (lines ~303-323): 1 × setLoading, 1 × setErrorMessage
- `withFocusGuard` (lines ~467-506): 1 × setSuccessMessage, 3 × setErrorMessage
- `handleUnlinkProvider` (lines ~534-545): 1 × setLoading, 1 × setSuccessMessage, 1 × setErrorMessage
- `handleUpdatePassword` (lines ~422-441): 1 × setLoading, 1 × setSuccessMessage, 2 × setErrorMessage
- `handleAddEmailPassword` (lines ~443-462): 1 × setLoading, 1 × setSuccessMessage, 2 × setErrorMessage

Also remove `setLoading` / `setSuccessMessage` / `setErrorMessage` from `resetTransientState`:
```ts
const resetTransientState = useCallback(() => {
  dispatch({ type: "CLEAR" }); // replaces clearMessages() + the individual setters
  setCurrentPassword("");
  // ... rest unchanged
}, []);
```

- [ ] **Step 4: Run tests and lint**

```bash
cd Frontend
bun test
bun lint
```

Expected: tests pass. Lint still shows 2 suppressions (lines 121, 142).

- [ ] **Step 5: Commit**

```bash
git add Frontend/app/components/account/formReducer.ts Frontend/app/components/AccountModal.tsx
git commit -m "refactor(account): add formReducer, replace loading/success/error useState (#585)"
```

---

### Task 3: Extract `ProfileTab`

**Files:**
- Create: `Frontend/app/components/account/ProfileTab.tsx`
- Modify: `Frontend/app/components/AccountModal.tsx`

**Interfaces:**
- Consumes: `FormState`, `FormAction` from `./formReducer`
- Produces: `ProfileTab` component

The profile panel (lines 910-947 in original) renders: success/error banners, displayName input, email input (disabled), save button, studio shortcut link. Photo picker stays in AccountModal header — NOT in ProfileTab.

- [ ] **Step 1: Create `Frontend/app/components/account/ProfileTab.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import type { FormState, FormAction } from "./formReducer";

interface ProfileTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
  isOpen: boolean;
}

const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30";
const labelClass = "block text-xs font-medium text-white/50 mb-1.5";

export default function ProfileTab({ formState, dispatch, isOpen }: ProfileTabProps) {
  const { user, updateUserProfile, isTranslator, userRole } = useAuth();
  const { loading, successMessage, errorMessage } = formState;

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email] = useState(user?.email ?? "");

  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.displayName ?? "");
    }
  }, [user, isOpen]);

  const handleUpdateProfile = async () => {
    dispatch({ type: "CLEAR" });
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await updateUserProfile(displayName);
      dispatch({ type: "SET_SUCCESS", message: "อัปเดตชื่อผู้ใช้สำเร็จ ✓" });
    } catch (error: unknown) {
      const { errMessage } = await import("@/lib/errMessage");
      dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  return (
    <>
      {successMessage && (
        <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className={labelClass}>ชื่อผู้ใช้</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ชื่อของคุณ"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>อีเมล</label>
          <input
            type="email"
            value={email}
            disabled
            title="อีเมล (ไม่สามารถแก้ไขได้)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 outline-none cursor-not-allowed"
          />
          <p className="text-[11px] text-white/30 mt-1.5">ไม่สามารถเปลี่ยนอีเมลได้ในขณะนี้</p>
        </div>
        <button
          onClick={handleUpdateProfile}
          disabled={loading || !displayName.trim()}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>

        <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70">สตูดิโอนักแปล</p>
              <p className="text-[11px] text-white/30">
                {isTranslator ? "จัดการงานแปลและอัปโหลดใหม่" : "สมัครเพื่อเริ่มอัปโหลดงานแปล"}
              </p>
            </div>
            <Link
              href="/studio"
              className="rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-600/30"
            >
              {isTranslator ? "เปิดสตูดิโอ" : "สมัคร"}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
```

Note: `errMessage` is imported dynamically inside the catch to avoid importing at module level (keeps the import list clean). Alternatively import it at the top: `import { errMessage } from "@/lib/errMessage";` — either is fine.

- [ ] **Step 2: Replace profile panel content in AccountModal**

Find the profile panel section (lines ~910-947) in `AccountModal.tsx`:

```tsx
// BEFORE — inside <div ref={profileRef} className={panelClass("profile")}>
{successMessage && <div ...>{successMessage}</div>}
{errorMessage && <div ...>{errorMessage}</div>}
<div className="space-y-4">
  ... (displayName input, email input, save button, studio link)
</div>
```

```tsx
// AFTER
import ProfileTab from "./account/ProfileTab";

// Inside <div ref={profileRef} className={panelClass("profile")}>:
<ProfileTab formState={formState} dispatch={dispatch} isOpen={isOpen} />
```

Also remove from AccountModal the state that moved to ProfileTab:
```ts
// DELETE from AccountModal:
const [displayName, setDisplayName] = useState("");
const [email, setEmail] = useState("");
```

And remove from the `user/isOpen` effect (line ~134) the two lines:
```ts
setDisplayName(user.displayName || "");
setEmail(user.email || "");
```

- [ ] **Step 3: Run tests and lint**

```bash
cd Frontend
bun test
bun lint
```

Expected: tests pass. `displayName` and `email` no longer referenced in AccountModal (no TS errors).

- [ ] **Step 4: Commit**

```bash
git add Frontend/app/components/account/ProfileTab.tsx Frontend/app/components/AccountModal.tsx
git commit -m "refactor(account): extract ProfileTab component (#585)"
```

---

### Task 4: Extract `PasswordTab`

**Files:**
- Create: `Frontend/app/components/account/PasswordTab.tsx`
- Modify: `Frontend/app/components/AccountModal.tsx`

**Interfaces:**
- Consumes: `FormState`, `FormAction` from `./formReducer`

- [ ] **Step 1: Create `Frontend/app/components/account/PasswordTab.tsx`**

```tsx
"use client";

import { useState } from "react";
import { errMessage } from "@/lib/errMessage";
import { useAuth } from "../../contexts/AuthContext";
import type { FormState, FormAction } from "./formReducer";

interface PasswordTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
}

const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30";
const labelClass = "block text-xs font-medium text-white/50 mb-1.5";

export default function PasswordTab({ formState, dispatch }: PasswordTabProps) {
  const { user, updateUserPassword, addEmailPassword } = useAuth();
  const { loading, successMessage, errorMessage } = formState;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const hasPasswordProvider = user?.providerData.some(p => p.providerId === "password");

  const handleUpdatePassword = async () => {
    dispatch({ type: "CLEAR" });
    if (newPassword !== confirmPassword) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านใหม่ไม่ตรงกัน" });
      return;
    }
    if (newPassword.length < 6) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await updateUserPassword(currentPassword, newPassword);
      dispatch({ type: "SET_SUCCESS", message: "เปลี่ยนรหัสผ่านสำเร็จ ✓" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        dispatch({ type: "SET_ERROR", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  const handleAddEmailPassword = async () => {
    dispatch({ type: "CLEAR" });
    if (newPassword !== confirmPassword) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านไม่ตรงกัน" });
      return;
    }
    if (newPassword.length < 6) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await addEmailPassword(newPassword);
      dispatch({ type: "SET_SUCCESS", message: "เพิ่มรหัสผ่านสำเร็จ ✓ ตอนนี้คุณสามารถ login ด้วย Email ได้แล้ว" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/provider-already-linked") {
        dispatch({ type: "SET_ERROR", message: "เชื่อมต่อ Email/Password อยู่แล้ว" });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  return (
    <>
      {successMessage && (
        <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}
      {hasPasswordProvider ? (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>รหัสผ่านปัจจุบัน</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>รหัสผ่านใหม่</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="•••••••• (อย่างน้อย 6 ตัว)" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ยืนยันรหัสผ่านใหม่</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>
          <button
            onClick={handleUpdatePassword}
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
            <p className="text-xs text-blue-300">ℹ️ เพิ่มรหัสผ่านเพื่อให้สามารถ login ด้วย Email <strong>{user?.email}</strong> ได้โดยไม่ต้องใช้ Google</p>
          </div>
          <div>
            <label className={labelClass}>รหัสผ่านใหม่</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="•••••••• (อย่างน้อย 6 ตัว)" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ยืนยันรหัสผ่าน</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>
          <button
            onClick={handleAddEmailPassword}
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังเพิ่มรหัสผ่าน..." : "เพิ่มรหัสผ่าน"}
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace password panel content in AccountModal**

Find the password panel section (lines ~949-992) in `AccountModal.tsx`:

```tsx
// BEFORE — inside <div ref={passwordRef} className={panelClass("password")}>
{successMessage && ...}
{errorMessage && ...}
{hasPasswordProvider ? ( ... ) : ( ... )}
```

```tsx
// AFTER
import PasswordTab from "./account/PasswordTab";

// Inside <div ref={passwordRef} className={panelClass("password")}>:
<PasswordTab formState={formState} dispatch={dispatch} />
```

Remove from AccountModal:
```ts
// DELETE from AccountModal:
const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
```

Remove `handleUpdatePassword` and `handleAddEmailPassword` handler functions from AccountModal (they moved to PasswordTab).

Also remove from `resetTransientState`:
```ts
// DELETE these lines from resetTransientState:
setCurrentPassword("");
setNewPassword("");
setConfirmPassword("");
```

- [ ] **Step 3: Run tests and lint**

```bash
cd Frontend
bun test
bun lint
```

Expected: tests pass, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add Frontend/app/components/account/PasswordTab.tsx Frontend/app/components/AccountModal.tsx
git commit -m "refactor(account): extract PasswordTab component (#585)"
```

---

### Task 5: Extract `AccountsTab`

**Files:**
- Create: `Frontend/app/components/account/AccountsTab.tsx`
- Modify: `Frontend/app/components/AccountModal.tsx`

**Interfaces:**
- Consumes: `FormState`, `FormAction` from `./formReducer`; `onTabChange`, `onClose`

- [ ] **Step 1: Create `Frontend/app/components/account/AccountsTab.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { errMessage } from "@/lib/errMessage";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type { FormState, FormAction } from "./formReducer";

type Tab = "profile" | "password" | "accounts" | "danger";

interface AccountsTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
  onTabChange: (tab: Tab) => void;
  onClose: () => void;
}

export default function AccountsTab({ formState, dispatch, onTabChange, onClose }: AccountsTabProps) {
  const {
    user, linkGoogleAccount, linkFacebookAccount, unlinkAccount,
    switchToConflictingAccount, resendVerificationEmail,
  } = useAuth();
  const { showToast } = useToast();
  const { loading, successMessage, errorMessage } = formState;

  const [linking, setLinking] = useState<"google" | "facebook" | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const linkingResolvedRef = useRef(false);

  const hasGoogleProvider = user?.providerData.some(p => p.providerId === "google.com");
  const hasFacebookProvider = user?.providerData.some(p => p.providerId === "facebook.com");
  const hasPasswordProvider = user?.providerData.some(p => p.providerId === "password");

  const showConflict = (info: { credential: unknown; provider: "google" | "facebook" }) => {
    showToast({
      type: "warning",
      message: (
        <>
          บัญชี <span className="font-semibold text-white">{info.provider === "google" ? "Google" : "Facebook"}</span> นี้ผูกกับ MangaDock อีกบัญชีอยู่แล้ว
        </>
      ),
      duration: 0,
      action: {
        label: "เข้าบัญชีนั้น",
        onClick: async () => {
          try {
            await switchToConflictingAccount(info.credential);
            onClose();
          } catch (error: unknown) {
            dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
          }
        },
      },
    });
  };

  const withFocusGuard = (provider: "google" | "facebook", fn: () => Promise<void>) => async () => {
    dispatch({ type: "CLEAR" });
    setLinking(provider);
    linkingResolvedRef.current = false;

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const onFocus = () => {
      focusTimer = setTimeout(() => {
        if (!linkingResolvedRef.current) setLinking(null);
      }, 2000);
    };
    window.addEventListener("focus", onFocus, { once: true });

    try {
      await fn();
      linkingResolvedRef.current = true;
      dispatch({ type: "SET_SUCCESS", message: `เชื่อมต่อบัญชี ${provider === "google" ? "Google" : "Facebook"} สำเร็จ ✓` });
    } catch (error: unknown) {
      linkingResolvedRef.current = true;
      const code = (error as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user closed popup — silent reset
      } else if (code === "auth/credential-already-in-use") {
        const credential = (error as { credential?: unknown }).credential;
        if (credential) {
          showConflict({ credential, provider });
        } else {
          dispatch({ type: "SET_ERROR", message: `บัญชี ${provider === "google" ? "Google" : "Facebook"} นี้เชื่อมต่อกับผู้ใช้อื่นแล้ว` });
        }
      } else if (code === "auth/provider-already-linked") {
        dispatch({ type: "SET_ERROR", message: `เชื่อมต่อกับ ${provider === "google" ? "Google" : "Facebook"} อยู่แล้ว` });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      if (focusTimer) clearTimeout(focusTimer);
      setLinking(null);
    }
  };

  const handleLinkGoogle = withFocusGuard("google", linkGoogleAccount);
  const handleLinkFacebook = withFocusGuard("facebook", linkFacebookAccount);

  const handleUnlinkProvider = async (providerId: string) => {
    dispatch({ type: "CLEAR" });
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await unlinkAccount(providerId);
      dispatch({ type: "SET_SUCCESS", message: "ยกเลิกการเชื่อมต่อสำเร็จ ✓" });
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  return (
    <>
      {successMessage && (
        <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}
      <div className="space-y-3">
        {/* Email/Password row */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-500">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white font-medium">อีเมล/รหัสผ่าน</p>
                <p className="text-xs text-white/40">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center">
              {hasPasswordProvider ? (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300">เชื่อมต่อแล้ว</span>
              ) : (
                <div className="group relative flex items-center">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 cursor-default select-none">
                    ไม่ได้ตั้งค่า
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 text-[9px] font-bold leading-none">i</span>
                  </span>
                  <div className="absolute top-full right-0 pt-2 hidden group-hover:block z-50">
                    <div className="w-52 rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-[11px] text-white/70 shadow-xl backdrop-blur-xl">
                      ไปที่แท็บ{" "}
                      <strong
                        className="text-white underline decoration-white/40 cursor-pointer hover:text-amber-300 hover:decoration-amber-300"
                        onClick={() => onTabChange("password")}
                      >
                        เพิ่มรหัสผ่าน
                      </strong>{" "}
                      เพื่อตั้งรหัสผ่าน แล้วจะสามารถ Login ด้วย Email ได้โดยไม่ต้องใช้ Google
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Email verification status */}
          <div className="flex items-center justify-between pl-12">
            {user?.emailVerified ? (
              <span className="flex items-center gap-1.5 text-[11px] text-green-400/80">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                ยืนยัน email แล้ว
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.17 14.17A1 1 0 003 19.5h18a1 1 0 00.88-1.47L13.71 3.86a2 2 0 00-3.52.14z" />
                </svg>
                ยังไม่ได้ยืนยัน email
              </span>
            )}
            {!user?.emailVerified && (
              <button
                onClick={async () => {
                  setSendingVerification(true);
                  try {
                    await resendVerificationEmail();
                  } catch {
                    showToast({ type: "error", message: "ส่ง email ไม่สำเร็จ ลองใหม่ภายหลัง", duration: 4000 });
                  } finally {
                    setSendingVerification(false);
                  }
                }}
                disabled={sendingVerification}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/20 active:scale-95 disabled:opacity-50"
              >
                {sendingVerification ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    กำลังส่ง…
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    ส่ง email ยืนยัน
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Facebook row */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
                <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-white font-medium">Facebook</p>
              <p className="text-xs text-white/40">เข้าสู่ระบบด้วยบัญชี Facebook</p>
            </div>
          </div>
          {hasFacebookProvider ? (
            <button
              onClick={() => handleUnlinkProvider("facebook.com")}
              disabled={loading || !!linking || (!hasPasswordProvider && !hasGoogleProvider)}
              title={(!hasPasswordProvider && !hasGoogleProvider) ? "ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี" : ""}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ยกเลิก
            </button>
          ) : (
            <button
              onClick={handleLinkFacebook}
              disabled={!!linking || loading}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {linking === "facebook" ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  กำลังเชื่อมต่อ…
                </span>
              ) : "เชื่อมต่อ"}
            </button>
          )}
        </div>

        {/* Google row */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-white font-medium">Google</p>
              <p className="text-xs text-white/40">เข้าสู่ระบบด้วยบัญชี Google</p>
            </div>
          </div>
          {hasGoogleProvider ? (
            <button
              onClick={() => handleUnlinkProvider("google.com")}
              disabled={loading || !!linking || (!hasPasswordProvider && !hasFacebookProvider)}
              title={(!hasPasswordProvider && !hasFacebookProvider) ? "ต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี" : ""}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ยกเลิก
            </button>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={!!linking || loading}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {linking === "google" ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  กำลังเชื่อมต่อ…
                </span>
              ) : "เชื่อมต่อ"}
            </button>
          )}
        </div>

        <p className="text-[11px] text-white/30 pt-1">💡 เชื่อมต่อบัญชีหลายแบบเพื่อเข้าสู่ระบบได้หลายวิธี</p>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Replace accounts panel content in AccountModal**

Find the accounts panel section (lines ~994-1146) in `AccountModal.tsx`:

```tsx
// AFTER
import AccountsTab from "./account/AccountsTab";

// Inside <div ref={accountsRef} className={panelClass("accounts")}>:
<AccountsTab
  formState={formState}
  dispatch={dispatch}
  onTabChange={handleTabChange}
  onClose={handleClose}
/>
```

Remove from AccountModal: `linking` state, `linkingResolvedRef`, `sendingVerification` state, `withFocusGuard`, `showConflict`, `handleLinkGoogle`, `handleLinkFacebook`, `handleUnlinkProvider`.

Remove from `resetTransientState`: (none of these were in resetTransientState).

Also clean `handleTabChange` — it currently resets `showPhotoPicker`, `photoError`, `deleteStep`, `deleteConfirmText`, `reauthPassword`. After DangerTab extraction (next task), remove the danger-related resets. For now keep them.

- [ ] **Step 3: Run tests and lint**

```bash
cd Frontend
bun test
bun lint
```

- [ ] **Step 4: Commit**

```bash
git add Frontend/app/components/account/AccountsTab.tsx Frontend/app/components/AccountModal.tsx
git commit -m "refactor(account): extract AccountsTab component (#585)"
```

---

### Task 6: Extract `DangerTab`

**Files:**
- Create: `Frontend/app/components/account/DangerTab.tsx`
- Modify: `Frontend/app/components/AccountModal.tsx`

**Interfaces:**
- Consumes: `FormState`, `FormAction` from `./formReducer`; `onClose`

- [ ] **Step 1: Create `Frontend/app/components/account/DangerTab.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { errMessage } from "@/lib/errMessage";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type { FormState, FormAction } from "./formReducer";

interface DangerTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
  onClose: () => void;
}

export default function DangerTab({ formState, dispatch, onClose }: DangerTabProps) {
  const { user, reauthenticateUser, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const { loading, errorMessage } = formState;

  const [deleteStep, setDeleteStep] = useState<"idle" | "reauth" | "confirm">("idle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthenticating, setReauthenticating] = useState<"password" | "google" | "facebook" | null>(null);
  const reauthResolvedRef = useRef(false);

  const hasGoogleProvider = user?.providerData.some(p => p.providerId === "google.com");
  const hasFacebookProvider = user?.providerData.some(p => p.providerId === "facebook.com");
  const hasPasswordProvider = user?.providerData.some(p => p.providerId === "password");

  const handlePasswordReauthForDelete = async () => {
    setReauthenticating("password");
    dispatch({ type: "CLEAR" });
    try {
      await reauthenticateUser("password", reauthPassword);
      setDeleteStep("confirm");
      setDeleteConfirmText("");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        dispatch({ type: "SET_ERROR", message: "รหัสผ่านไม่ถูกต้อง" });
      } else if (code === "auth/user-mismatch") {
        dispatch({ type: "SET_ERROR", message: "รหัสผ่านนี้ไม่ตรงกับบัญชีที่กำลังจะลบ กรุณาใช้รหัสผ่านของบัญชีนี้" });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      setReauthenticating(null);
    }
  };

  const withDeleteReauthPopupGuard = (provider: "google" | "facebook") => async () => {
    setReauthenticating(provider);
    dispatch({ type: "CLEAR" });
    reauthResolvedRef.current = false;

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const onFocus = () => {
      focusTimer = setTimeout(() => {
        if (!reauthResolvedRef.current) setReauthenticating(null);
      }, 2000);
    };
    window.addEventListener("focus", onFocus, { once: true });

    try {
      await reauthenticateUser(provider);
      reauthResolvedRef.current = true;
      setDeleteStep("confirm");
      setDeleteConfirmText("");
    } catch (error: unknown) {
      reauthResolvedRef.current = true;
      const code = (error as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user closed popup — keep reauth step open
      } else if (code === "auth/popup-blocked") {
        dispatch({ type: "SET_ERROR", message: "เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup แล้วลองอีกครั้ง" });
      } else if (code === "auth/user-mismatch") {
        dispatch({ type: "SET_ERROR", message: `บัญชี ${provider === "google" ? "Google" : "Facebook"} ที่เลือกไม่ตรงกับบัญชีที่กำลังจะลบ กรุณาเลือกบัญชีให้ถูกต้อง` });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      window.removeEventListener("focus", onFocus);
      if (focusTimer) clearTimeout(focusTimer);
      setReauthenticating(null);
    }
  };

  const handleDeleteReauthGoogle = withDeleteReauthPopupGuard("google");
  const handleDeleteReauthFacebook = withDeleteReauthPopupGuard("facebook");

  const handleDeleteAccount = async () => {
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await deleteAccount();
      onClose();
      showToast({
        type: "success",
        message: (
          <>
            ลบบัญชีสำเร็จแล้ว —{" "}
            <span className="font-semibold text-white">ขอบคุณที่ใช้บริการ MangaDock</span>
          </>
        ),
        duration: 5000,
      });
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/20">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.17 14.17A1 1 0 003 19.5h18a1 1 0 00.88-1.47L13.71 3.86a2 2 0 00-3.52.14z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-red-300">ลบบัญชีถาวร</p>
          <p className="text-xs text-white/50 mt-0.5">ข้อมูลทั้งหมดจะถูกลบอย่างถาวร ไม่สามารถย้อนกลับได้</p>
        </div>
      </div>

      <ul className="space-y-1.5 text-xs text-white/40 pl-1">
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />ประวัติการอ่านทั้งหมด</li>
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />รายการโปรดทั้งหมด</li>
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />รูปโปรไฟล์ที่อัปโหลดทั้งหมด</li>
        <li className="flex items-center gap-2"><span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />บัญชีผู้ใช้และข้อมูลทั้งหมด</li>
      </ul>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {deleteStep === "idle" && (
        <button
          onClick={() => { dispatch({ type: "CLEAR" }); setDeleteStep("reauth"); }}
          className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-95"
        >
          ลบบัญชีของฉัน
        </button>
      )}

      {deleteStep === "reauth" && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-yellow-300/80">เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยวิธีที่คุณเชื่อมต่อไว้</p>
          {hasPasswordProvider && (
            <div className="space-y-2">
              <input
                type="password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="รหัสผ่านของคุณ"
                autoFocus
                className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/30"
                onKeyDown={(e) => { if (e.key === "Enter" && reauthPassword) handlePasswordReauthForDelete(); }}
              />
              <button
                onClick={handlePasswordReauthForDelete}
                disabled={!reauthPassword || !!reauthenticating}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-600 py-2.5 text-sm font-semibold text-white transition hover:bg-yellow-500 active:scale-95 disabled:opacity-50"
              >
                {reauthenticating === "password" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    กำลังยืนยัน…
                  </>
                ) : "ยืนยันด้วยรหัสผ่าน"}
              </button>
            </div>
          )}
          {hasPasswordProvider && (hasGoogleProvider || hasFacebookProvider) && (
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] text-white/30">หรือ</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}
          {hasGoogleProvider && (
            <button
              onClick={handleDeleteReauthGoogle}
              disabled={!!reauthenticating}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
            >
              {reauthenticating === "google" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {reauthenticating === "google" ? "กำลังยืนยัน…" : "ยืนยันด้วย Google"}
            </button>
          )}
          {hasFacebookProvider && (
            <button
              onClick={handleDeleteReauthFacebook}
              disabled={!!reauthenticating}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 py-2.5 text-sm font-semibold text-[#74a9f5] transition hover:bg-[#1877F2]/20 active:scale-95 disabled:opacity-50"
            >
              {reauthenticating === "facebook" ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              {reauthenticating === "facebook" ? "กำลังยืนยัน…" : "ยืนยันด้วย Facebook"}
            </button>
          )}
          <button
            onClick={() => { setDeleteStep("idle"); setReauthPassword(""); dispatch({ type: "CLEAR" }); }}
            disabled={!!reauthenticating}
            className="w-full rounded-xl border border-white/15 py-2 text-xs font-medium text-white/40 transition hover:bg-white/5 hover:text-white/60 active:scale-95"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {deleteStep === "confirm" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-red-300">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            <p className="text-[11px] text-white/40">ข้อมูล รูปโปรไฟล์ ประวัติการอ่าน และรายการโปรดทั้งหมดจะหายไปตลอดกาล</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] text-white/50">
              พิมพ์ <span className="font-mono font-semibold text-red-300">ลบบัญชี</span> เพื่อยืนยัน
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => { setDeleteConfirmText(e.target.value); dispatch({ type: "CLEAR" }); }}
              placeholder="ลบบัญชี"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none font-mono transition focus:border-red-400/60 focus:ring-1 focus:ring-red-400/30"
              onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmText === "ลบบัญชี") handleDeleteAccount(); }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "ลบบัญชี" || loading}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading ? "กำลังลบ..." : "ลบบัญชีนี้"}
            </button>
            <button
              onClick={() => { setDeleteStep("idle"); setDeleteConfirmText(""); dispatch({ type: "CLEAR" }); }}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80 active:scale-95"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace danger panel content in AccountModal**

Find the danger panel section (lines ~1148-1338) in `AccountModal.tsx`:

```tsx
// AFTER
import DangerTab from "./account/DangerTab";

// Inside <div ref={dangerRef} className={panelClass("danger")}>:
<DangerTab formState={formState} dispatch={dispatch} onClose={handleClose} />
```

Remove from AccountModal:
- `deleteStep`, `deleteConfirmText`, `reauthPassword`, `reauthenticating`, `reauthResolvedRef`, `sendingVerification` states
- `handlePasswordReauthForDelete`, `withDeleteReauthPopupGuard`, `handleDeleteReauthGoogle`, `handleDeleteReauthFacebook`, `handleDeleteAccount` functions

Remove from `resetTransientState` in AccountModal:
```ts
// DELETE from resetTransientState:
setDeleteStep("idle");
setDeleteConfirmText("");
setReauthPassword("");
setReauthenticating(null);
```

Clean up `handleTabChange` — remove the lines that reset state now in DangerTab:
```ts
// BEFORE
const handleTabChange = (t: Tab) => {
  clearMessages();
  setTab(t);
  setShowPhotoPicker(false);
  setPhotoError(null);
  setDeleteStep("idle");      // DELETE — now in DangerTab
  setDeleteConfirmText("");   // DELETE
  setReauthPassword("");      // DELETE
  if (asPage) setPageView("detail");
};
```

- [ ] **Step 3: Run tests and lint**

```bash
cd Frontend
bun test
bun lint
```

- [ ] **Step 4: Commit**

```bash
git add Frontend/app/components/account/DangerTab.tsx Frontend/app/components/AccountModal.tsx
git commit -m "refactor(account): extract DangerTab component (#585)"
```

---

### Task 7: Fix final exhaustive-deps suppression + zero-suppression gate

**Files:**
- Modify: `Frontend/app/components/AccountModal.tsx`

After Tasks 1-6 only one suppression should remain in AccountModal: line ~121 (`[isOpen, initialTab, asPage]` missing `onClose` and `router`).

- [ ] **Step 1: Fix the open/close effect (line ~121)**

Find the effect:
```ts
useEffect(() => {
  if (isOpen && !asPage) {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      router.push(`/account${initialTab ? `?tab=${initialTab}` : ""}`);
      onClose();
      return;
    }
    // ...
  }
  // ...
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen, initialTab, asPage]);
```

Remove the suppression comment and add `onClose` and `router` to deps:
```ts
}, [isOpen, initialTab, asPage, onClose, router]);
```

`router` from `useRouter()` is stable per Next.js docs (same reference across renders). `onClose` must be stable at the callsite — verify that all callers pass a `useCallback`-wrapped function. If a caller passes an inline arrow function, wrap it there. (Grep: `<AccountModal onClose=` to find all callsites.)

- [ ] **Step 2: Verify the `user/isOpen` effect (line ~142 area)**

After Task 3 removed `setDisplayName`/`setEmail` from this effect, it now looks like:
```ts
useEffect(() => {
  if (user && isOpen) {
    getPhotoHistory().then(setPreviousPhotos).catch(() => setPreviousPhotos([]));
  }
  if (!isOpen) { setShowPhotoPicker(false); setPhotoError(null); }
// eslint-disable-next-line react-hooks/exhaustive-deps  ← should be gone
}, [user, isOpen, getPhotoHistory]); // getPhotoHistory now stable from Task 1
```

Confirm the suppression comment has been removed and `getPhotoHistory` is in the deps array. `getPhotoHistory` is now `useCallback`-wrapped from Task 1, so this is safe.

- [ ] **Step 3: Grep for any remaining suppressions**

```bash
cd Frontend
grep -rn "eslint-disable.*exhaustive-deps" app/components/AccountModal.tsx app/components/account/
```

Expected output: (empty — no matches)

- [ ] **Step 4: Run lint**

```bash
cd Frontend
bun lint
```

Expected: exits 0 with no `react-hooks/exhaustive-deps` warnings anywhere in the account components.

- [ ] **Step 5: Run tests**

```bash
cd Frontend
bun test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add Frontend/app/components/AccountModal.tsx
git commit -m "fix(account): remove all exhaustive-deps suppressions (#585)"
```

---

### Task 8: Verify and close

**Files:** none (verification only)

- [ ] **Step 1: Confirm file structure**

```bash
ls Frontend/app/components/account/
```

Expected output:
```
DangerTab.tsx
AccountsTab.tsx
PasswordTab.tsx
ProfileTab.tsx
formReducer.ts
```

- [ ] **Step 2: Confirm AccountModal line count reduced**

```bash
wc -l Frontend/app/components/AccountModal.tsx
```

Expected: ≤ 650 lines (down from 1 383).

- [ ] **Step 3: Confirm zero suppressions**

```bash
grep -rn "eslint-disable.*exhaustive-deps" Frontend/app/components/AccountModal.tsx Frontend/app/components/account/
```

Expected: (no output)

- [ ] **Step 4: Final lint + test**

```bash
cd Frontend
bun lint && bun test
```

Both must exit 0.

- [ ] **Step 5: Close issue**

```bash
"C:\Program Files\GitHub CLI\gh.exe" issue close 585 --repo Slow-Inc/MangaDock --comment "Implemented: 4 tab children extracted, formReducer added, 0 exhaustive-deps suppressions remain."
```

- [ ] **Step 6: Notify**

```bash
pwsh -NoProfile -File scripts/notify.ps1 -Message "done: #585 AccountModal split — 4 tabs, reducer, 0 exhaustive-deps"
```
