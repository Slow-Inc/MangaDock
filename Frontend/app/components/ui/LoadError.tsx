"use client";

import { useState } from "react";
import Mascot from "../mascot/Mascot";
import type { MascotArea } from "../../lib/mascot";

/**
 * A failed load: says so and offers a retry, in place of an empty list that would read as "nothing here"
 * (#828 for Studio, #911 for the public pages). `onRetry` may return a promise; the button shows busy until it settles.
 */
export default function LoadError({
  what,
  onRetry,
  area = "error",
  framed = true,
}: {
  what: string;
  onRetry: () => unknown;
  area?: MascotArea;
  /** false inside a dialog that already frames and names it: no card, and no alert repeating the dialog's label */
  framed?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      role={framed ? "alert" : undefined}
      className={`flex flex-col items-center gap-3 text-center ${framed ? "rounded-2xl border border-line bg-surface px-6 py-12" : "py-2"}`}
    >
      <Mascot area={area} state="sleeping" size={64} />
      <p className="text-sm font-medium text-ink">โหลด{what}ไม่สำเร็จ</p>
      <p className="text-xs text-ink-3">ลองโหลดใหม่อีกครั้ง</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => { setBusy(true); Promise.resolve(onRetry()).finally(() => setBusy(false)); }}
        className="mt-1 rounded-xl border border-line bg-fill px-4 py-2 text-sm font-medium text-ink smooth-hover-fast hover:border-ink-3 hover:bg-raised disabled:opacity-60"
      >
        {busy ? "กำลังโหลด…" : "ลองใหม่"}
      </button>
    </div>
  );
}
