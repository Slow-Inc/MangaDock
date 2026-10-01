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
