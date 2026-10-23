"use client";

import { useCallback, useContext, useRef, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useModalDialog } from "../hooks/useDialogFocus";

type Props = {
  contentType: "post" | "manga" | "translation";
  contentId: string;
  variant?: "icon" | "menu-item";
};

const REASONS: { value: string; label: string }[] = [
  { value: "spam",          label: "สแปม / โฆษณา" },
  { value: "inappropriate", label: "เนื้อหาไม่เหมาะสม" },
  { value: "misinformation",label: "ข้อมูลเท็จ / หลอกลวง" },
  { value: "copyright",     label: "ละเมิดลิขสิทธิ์" },
  { value: "other",         label: "อื่นๆ" },
];

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function ReportButton({ contentType, contentId, variant = "icon" }: Props) {
  const { user, showLoginPrompt } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useModalDialog(dialogRef, close, open);

  function handleOpen() {
    if (!user) { showLoginPrompt(); return; }
    setOpen(true);
    setDone(false);
    setError("");
    setReason("");
    setDetails("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) { setOpen(false); showLoginPrompt(); return; } // retrying can't help a dead session
      const res = await fetch("/api/proxy/content-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType, contentId, reason, details }),
      });
      // "ส่งรายงานแล้ว" only for a report that was stored — it used to show for a 401/500 too (#987)
      if (!res.ok) throw new Error(`report ${res.status}`);
      setDone(true);
    } catch {
      setError("ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const trigger =
    variant === "menu-item" ? (
      <button
        onClick={handleOpen}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger/80 transition hover:bg-danger/10 hover:text-danger"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 9.143M3 3h13m0 0l1.664 9.143M16 3l1.664 9.143M4.664 12.143h12.672M6 21l1-4h10l1 4" />
        </svg>
        รายงาน
      </button>
    ) : (
      <button
        onClick={handleOpen}
        title="รายงาน"
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 transition hover:bg-danger/10 hover:text-danger"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
      </button>
    );

  return (
    <>
      {trigger}

      {/* Modal */}
      {open && (
        <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="รายงานเนื้อหา"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/70 p-4 outline-none">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            {done ? (
              <div className="text-center">
                <div className="mb-3 text-3xl">✅</div>
                <p className="font-semibold text-ink">ส่งรายงานแล้ว</p>
                <p className="mt-1 text-sm text-ink-3">ขอบคุณที่ช่วยดูแลชุมชน</p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-5 w-full rounded-xl bg-fill py-2.5 text-sm text-ink-2 transition hover:bg-raised"
                >
                  ปิด
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-ink">รายงานเนื้อหา</p>
                  <button type="button" onClick={close} aria-label="ปิด" className="text-ink-2 transition hover:text-ink">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="mb-3 space-y-2">
                  {REASONS.map((r) => (
                    <label key={r.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${reason === r.value ? "border-accent/40 bg-accent/10" : "border-line hover:border-line"}`}>
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-accent"
                      />
                      <span className="text-sm text-ink">{r.label}</span>
                    </label>
                  ))}
                </div>
                {reason === "other" && (
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={1000} // the server's SubmitReportDto cap (#1015)
                    placeholder="อธิบายเพิ่มเติม..."
                    rows={2}
                    className="mb-3 w-full resize-none rounded-xl border border-line bg-fill px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-ink-3"
                  />
                )}
                <div role="alert">{error && <p className="mb-3 text-sm text-danger">{error}</p>}</div>
                <button
                  type="submit"
                  disabled={!reason || submitting}
                  className="w-full rounded-xl bg-danger/80 py-2.5 text-sm font-semibold text-bg transition enabled:hover:bg-danger disabled:opacity-40"
                >
                  {submitting ? "กำลังส่ง..." : "ส่งรายงาน"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
