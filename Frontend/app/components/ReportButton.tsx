"use client";

import { useContext, useRef, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

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
  const dialogRef = useRef<HTMLDivElement>(null);

  function handleOpen() {
    if (!user) { showLoginPrompt(); return; }
    setOpen(true);
    setDone(false);
    setReason("");
    setDetails("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      await fetch("/api/proxy/content-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType, contentId, reason, details }),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  const trigger =
    variant === "menu-item" ? (
      <button
        onClick={handleOpen}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400/80 transition hover:bg-red-500/10 hover:text-red-300"
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
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/25 transition hover:bg-red-500/10 hover:text-red-400"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div ref={dialogRef} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
            {done ? (
              <div className="text-center">
                <div className="mb-3 text-3xl">✅</div>
                <p className="font-semibold text-white/90">ส่งรายงานแล้ว</p>
                <p className="mt-1 text-sm text-white/40">ขอบคุณที่ช่วยดูแลชุมชน</p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-5 w-full rounded-xl bg-white/10 py-2.5 text-sm text-white/70 transition hover:bg-white/15"
                >
                  ปิด
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-white/90">รายงานเนื้อหา</p>
                  <button type="button" onClick={() => setOpen(false)} className="text-white/30 transition hover:text-white/70">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="mb-3 space-y-2">
                  {REASONS.map((r) => (
                    <label key={r.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${reason === r.value ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/8 hover:border-white/15"}`}>
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-white/75">{r.label}</span>
                    </label>
                  ))}
                </div>
                {reason === "other" && (
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="อธิบายเพิ่มเติม..."
                    rows={2}
                    className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-indigo-500/50"
                  />
                )}
                <button
                  type="submit"
                  disabled={!reason || submitting}
                  className="w-full rounded-xl bg-red-600/80 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-red-600 disabled:opacity-40"
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
