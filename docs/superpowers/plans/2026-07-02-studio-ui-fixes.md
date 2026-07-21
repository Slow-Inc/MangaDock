# Studio UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 Studio UI issues — OS-native confirm dialog, duplicated CoverImage component, fragmented version cache, developer copy in production, inaccessible SVG charts, and stale-closure risks in upload page.

**Architecture:** All fixes isolated to `Frontend/app/studio/`. No new dependencies. Tasks are independent and can be reviewed separately.

**Tech Stack:** Next.js 16, React 19, bun:test, TypeScript, Tailwind CSS, Recharts

## Global Constraints

- No new npm packages
- All user-visible strings Thai
- `bun lint` and `tsc --noEmit` must pass after every task
- Branch: `feat/frontend-ui` (branch off `feat/dashboard`)
- Working directory for all commands: `Frontend/`
- Do NOT read `.env` files
- `studioCache` = `getCached`/`setCache` from `app/lib/studioCache.ts`

---

### Task 1: Replace `window.confirm()` with `ConfirmDialog` component

**Files:**
- Create: `Frontend/app/studio/components/ConfirmDialog.tsx`
- Modify: `Frontend/app/studio/manga/[titleId]/page.tsx:368`

**Interfaces:**
- Produces: `ConfirmDialog({ open, title, onConfirm, onCancel }: ConfirmDialogProps)`

- [ ] **Step 1: Create `ConfirmDialog.tsx`**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, onConfirm, onCancel }: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      cancelRef.current?.focus();
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onCancel(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ยืนยันการดำเนินการ"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className={`w-full max-w-sm rounded-2xl bg-[#1a1a2e] p-6 shadow-xl transition-transform duration-200 ${visible ? "scale-100" : "scale-95"}`}>
        <p className="mb-6 text-sm text-white/80">{title}</p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-40"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-500/80 px-4 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-40"
          >
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `ConfirmDialog` into `studio/manga/[titleId]/page.tsx`**

```tsx
// 1. Add import:
import { ConfirmDialog } from "../components/ConfirmDialog";

// 2. Add state near other modal states:
const [confirmDelete, setConfirmDelete] = useState<ChapterVersion | null>(null);

// 3. Replace window.confirm call (line 368):
// BEFORE:
const handleDelete = async (version: ChapterVersion) => {
  if (!confirm(`ยืนยันการลบงานแปล ตอนที่ ${version.chapterNumber}?`)) return;
  try { ... }
};

// AFTER:
const handleDelete = (version: ChapterVersion) => {
  setConfirmDelete(version);
};

const executeDelete = async () => {
  if (!confirmDelete) return;
  const version = confirmDelete;
  setConfirmDelete(null);
  try {
    const token = await getIdToken();
    if (!token) throw new Error("ไม่พบ token");
    await deleteVersion(token, version.versionId);
    showToast({ type: "success", message: "ลบงานแปลแล้ว", duration: 2200 });
    await fetchVersions();
  } catch (e: unknown) {
    showToast({
      type: "error",
      message: e instanceof Error ? e.message : "ไม่สามารถลบงานแปลได้",
      duration: 3000,
    });
  }
};

// 4. Add ConfirmDialog to JSX (before closing </div> of page):
<ConfirmDialog
  open={confirmDelete !== null}
  title={`ยืนยันการลบงานแปล ตอนที่ ${confirmDelete?.chapterNumber}?`}
  onConfirm={executeDelete}
  onCancel={() => setConfirmDelete(null)}
/>
```

- [ ] **Step 3: Verify**

```bash
cd Frontend && tsc --noEmit && bun lint
# Also verify: grep -r "window.confirm" app/studio/ returns nothing
```

Expected: no errors, no `window.confirm` remaining.

- [ ] **Step 4: Commit**

```bash
git add app/studio/components/ConfirmDialog.tsx "app/studio/manga/[titleId]/page.tsx"
git commit -m "fix(studio): replace window.confirm with ConfirmDialog component"
```

---

### Task 2: Extract shared `CoverImage` component

**Files:**
- Create: `Frontend/app/studio/components/CoverImage.tsx`
- Modify: `Frontend/app/studio/manga/[titleId]/page.tsx:235-257`
- Modify: `Frontend/app/studio/works/page.tsx:71-82`

**Interfaces:**
- Produces: `CoverImage({ src, alt, className, fallbackSize }: CoverImageProps)`

- [ ] **Step 1: Create `CoverImage.tsx`** (merged from both inline versions)

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";

interface CoverImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSize?: number; // emoji font-size in px, default 32
}

export function CoverImage({ src, alt, className = "", fallbackSize = 32 }: CoverImageProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError || !src) {
    return (
      <div className={`flex items-center justify-center bg-white/5 ${className}`}>
        <span style={{ fontSize: fallbackSize }}>📚</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        onError={() => setImgError(true)}
        sizes="(max-width: 768px) 100vw, 200px"
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace inline definition in `studio/manga/[titleId]/page.tsx`**

Remove the local `CoverImage` component (lines 235–257) and replace with:

```tsx
import { CoverImage } from "../components/CoverImage";
```

All existing usages of `<CoverImage src=... alt=... className=... />` stay identical.

- [ ] **Step 3: Replace inline definition in `studio/works/page.tsx`**

Remove the local `CoverImage` component (lines 71–82) and replace with:

```tsx
import { CoverImage } from "../components/CoverImage";
```

If the works page passes `fallbackClass` or `fallbackSize` differently, map to the unified `fallbackSize` prop.

- [ ] **Step 4: Verify**

```bash
cd Frontend && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/studio/components/CoverImage.tsx \
  "app/studio/manga/[titleId]/page.tsx" app/studio/works/page.tsx
git commit -m "refactor(studio): extract shared CoverImage component"
```

---

### Task 3: Consolidate version cache to single `studioCache` key

**Files:**
- Modify: `Frontend/app/studio/page.tsx:103-125` (uses `"overview:versions"`)
- Modify: `Frontend/app/studio/works/page.tsx:142,165` (uses `"works:versions"`)
- Modify: `Frontend/app/studio/manga/[titleId]/page.tsx:270,332` (uses raw `localStorage`)

**Interfaces:**
- Consumes: `getCached`, `setCache` from `../../lib/studioCache`
- New cache key: `"studio:versions"` (replaces all three existing keys)

- [ ] **Step 1: Write failing test**

Create `Frontend/app/lib/studioCache.test.ts` (or add to existing if present):

```ts
import { describe, it, expect, beforeEach } from "bun:test";
import { getCached, setCache } from "./studioCache";

describe("studioCache version key", () => {
  beforeEach(() => {
    // Clear the studio:versions key before each test
    setCache("studio:versions", null as never);
  });

  it("getCached returns null before any write", () => {
    expect(getCached("studio:versions")).toBeNull();
  });

  it("round-trips data correctly", () => {
    const data = [{ versionId: "v1", chapterNumber: 1 }];
    setCache("studio:versions", data);
    expect(getCached("studio:versions")).toEqual(data);
  });
});
```

- [ ] **Step 2: Run test to confirm it works (should pass — testing existing studioCache)**

```bash
cd Frontend && bun test app/lib/studioCache.test.ts
```

Expected: `2 pass` (studioCache already works; test confirms the key contract).

- [ ] **Step 3: Update `studio/page.tsx`**

```ts
// Replace "overview:versions" with "studio:versions":
const cached = getCached<MyVersion[]>("studio:versions");
// ...
setCache("studio:versions", versions);
```

- [ ] **Step 4: Update `studio/works/page.tsx`**

```ts
// Replace "works:versions" with "studio:versions":
const cached = getCached<MyVersion[]>("studio:versions");
// ...
setCache("studio:versions", versions);
```

- [ ] **Step 5: Update `studio/manga/[titleId]/page.tsx`**

Remove all `localStorage.getItem("mb:studio:versions:cache")` and `localStorage.setItem(...)` calls. Replace with `getCached`/`setCache` from `studioCache`:

```ts
import { getCached, setCache } from "../../lib/studioCache";

// Replace localStorage reads:
// BEFORE: JSON.parse(localStorage.getItem("mb:studio:versions:cache") ?? "null")
// AFTER:  getCached<ChapterVersion[]>("studio:versions")

// Replace localStorage writes:
// BEFORE: localStorage.setItem("mb:studio:versions:cache", JSON.stringify(versions))
// AFTER:  setCache("studio:versions", versions)
```

- [ ] **Step 6: Verify**

```bash
cd Frontend && bun test app/lib/studioCache.test.ts && tsc --noEmit
```

Expected: `2 pass`, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add app/studio/page.tsx app/studio/works/page.tsx \
  "app/studio/manga/[titleId]/page.tsx" app/lib/studioCache.test.ts
git commit -m "refactor(studio): consolidate version cache to single studio:versions key"
```

---

### Task 4: Fix mobile hero copy — replace dev notes with user copy

**Files:**
- Modify: `Frontend/app/studio/page.tsx:174`
- Modify: `Frontend/app/studio/works/page.tsx:301`

**Interfaces:**
- No interface change — string replacement only

- [ ] **Step 1: Fix `studio/page.tsx:174`**

```tsx
// BEFORE (line 174):
"หน้าหลักแบบมือถือจะสรุปเฉพาะสิ่งสำคัญก่อน แล้วค่อยแยกข้อมูลลึกเป็นหน้าย่อยตามแบบ native ของโปรเจกต์"

// AFTER:
"ดูสถิติ รายได้ และกิจกรรมล่าสุดของคุณ"
```

- [ ] **Step 2: Fix `studio/works/page.tsx:301`**

```tsx
// BEFORE (line 301):
"มือถือจะโฟกัสที่รายการงานก่อน ส่วนตัวกรองและมุมมองจะถูกแยกเป็นหน้าจอย่อย"

// AFTER:
"จัดการงานแปลและบทของคุณทั้งหมดในที่เดียว"
```

- [ ] **Step 3: Verify**

```bash
cd Frontend && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/studio/page.tsx app/studio/works/page.tsx
git commit -m "fix(studio): replace developer rationale strings with user-facing copy"
```

---

### Task 5: Add accessibility to SVG charts

**Files:**
- Modify: `Frontend/app/studio/components/StudioDashboardWidgets.tsx` (4 chart components)

**Interfaces:**
- No interface change — adds `role` + `<title>` to existing `<svg>` elements rendered by Recharts

**Note:** Recharts renders `<ResponsiveContainer>` → `<svg>`. The `<title>` must be injected as a child of the SVG. Use Recharts' `customized` prop on `<LineChart>` / `<BarChart>` / `<PieChart>` to inject the title, or wrap with a positioned `<title>` via the `children` prop.

- [ ] **Step 1: Read `StudioDashboardWidgets.tsx` lines 150–380** to locate each chart's JSX before editing.

- [ ] **Step 2: Add `role="img"` and `<title>` to `LineChart`**

```tsx
// Recharts LineChart accepts arbitrary children — add <title> as first child:
<LineChart data={data} ...>
  <title>กราฟยอดวิวรายวัน</title>
  <CartesianGrid ... />
  {/* existing children */}
</LineChart>
// Also add role="img" to the wrapping <ResponsiveContainer> or outer <div> with aria-label
```

Because Recharts doesn't forward `role` to the `<svg>`, use a wrapper `<div role="img" aria-label="กราฟยอดวิวรายวัน">` around `<ResponsiveContainer>`.

- [ ] **Step 3: Apply same pattern to `GroupedBarChart`**

```tsx
<div role="img" aria-label="กราฟยอดวิวแยกตามมังงะ">
  <ResponsiveContainer ...>
    <BarChart data={data} ...>
      <title>กราฟยอดวิวแยกตามมังงะ</title>
      {/* existing children */}
    </BarChart>
  </ResponsiveContainer>
</div>
```

- [ ] **Step 4: Apply to `DonutChart` and `HorizontalBreakdownChart`**

```tsx
// DonutChart:
<div role="img" aria-label="กราฟสัดส่วนรายได้">
  <ResponsiveContainer ...><PieChart ...><title>กราฟสัดส่วนรายได้</title>...</PieChart></ResponsiveContainer>
</div>

// HorizontalBreakdownChart:
<div role="img" aria-label="กราฟรายได้แยกประเภท">
  <ResponsiveContainer ...><BarChart ...><title>กราฟรายได้แยกประเภท</title>...</BarChart></ResponsiveContainer>
</div>
```

- [ ] **Step 5: Verify**

```bash
cd Frontend && tsc --noEmit && bun lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/studio/components/StudioDashboardWidgets.tsx
git commit -m "fix(studio): add role=img and title to SVG charts for screen reader accessibility"
```

---

### Task 6: Fix `exhaustive-deps` suppressions in upload page

**Files:**
- Modify: `Frontend/app/studio/upload/page.tsx:451` and `:543`

**Note:** Read the suppressed `useEffect` blocks carefully before editing. The typical fix is one of:
1. Move the dependency value into a `useRef` so the function identity is stable
2. Wrap the callback in `useCallback` with the correct deps
3. Restructure the effect to not need the suppressed dep

- [ ] **Step 1: Read `upload/page.tsx` lines 440–560** to understand what each suppression hides before writing any code.

- [ ] **Step 2: Fix suppression at line 451**

Identify the stale dep. If it's a function (e.g. `handleUpload`), wrap it with `useCallback`:

```tsx
// Example pattern — adapt to actual code:
const handleUpload = useCallback(async () => {
  // existing body
}, [/* actual deps */]);

// Then the useEffect can list it cleanly:
useEffect(() => {
  // ... uses handleUpload
}, [handleUpload]); // no suppress needed
```

Remove the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment.

- [ ] **Step 3: Fix suppression at line 543**

Apply same approach — identify stale dep, stabilise with `useCallback` or `useRef`, remove suppress comment.

- [ ] **Step 4: Verify**

```bash
cd Frontend && tsc --noEmit && bun lint
```

Expected: no errors, no suppressed exhaustive-deps warnings.

- [ ] **Step 5: Commit**

```bash
git add app/studio/upload/page.tsx
git commit -m "fix(studio): resolve exhaustive-deps suppressions in upload page"
```
