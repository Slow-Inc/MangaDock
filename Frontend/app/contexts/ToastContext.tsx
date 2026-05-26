"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  ReactNode,
} from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type ToastType = "info" | "success" | "warning" | "error";

export type ToastOptions = {
  /** Main message text */
  message: ReactNode;
  /** Visual style. Defaults to "info". */
  type?: ToastType;
  /** Auto-dismiss duration in ms. 0 = no auto-dismiss. Defaults to 4000. */
  duration?: number;
  /** Optional action button. If onClick returns a Promise the button shows a
   *  spinner while pending and the toast dismisses when it resolves/rejects. */
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
    /** "primary" = blue (default), "white" = white with black text */
    variant?: "primary" | "white";
  };
};

type ToastContextType = {
  showToast: (opts: ToastOptions) => void;
  dismissToast: () => void;
};

// ── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  dismissToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ── Icon per type ──────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: ToastType }) {
  const base = "h-4 w-4";
  if (type === "success")
    return (
      <svg viewBox="0 0 24 24" className={`${base} text-green-400`} fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  if (type === "warning")
    return (
      <svg viewBox="0 0 24 24" className={`${base} text-yellow-400`} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.17 14.17A1 1 0 003 19.5h18a1 1 0 00.88-1.47L13.71 3.86a2 2 0 00-3.52.14z" />
      </svg>
    );
  if (type === "error")
    return (
      <svg viewBox="0 0 24 24" className={`${base} text-red-400`} fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  // info (default)
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${base} text-white/70`}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function iconBg(type: ToastType) {
  if (type === "success") return "bg-green-500/20";
  if (type === "warning") return "bg-yellow-500/20";
  if (type === "error") return "bg-red-500/20";
  return "bg-white/10";
}

function borderColor(type: ToastType) {
  if (type === "success") return "border-green-500/30";
  if (type === "warning") return "border-yellow-500/30";
  if (type === "error") return "border-red-500/30";
  return "border-white/15";
}

function progressColor(type: ToastType) {
  if (type === "success") return "bg-green-400/60";
  if (type === "warning") return "bg-yellow-400/60";
  if (type === "error") return "bg-red-400/60";
  return "bg-white/35";
}

// ── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const [visible, setVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the 300 ms "fade-out then setToast(null)" timer started by dismissToast.
  // Stored in a ref so showToast can cancel it if a new toast arrives before it fires —
  // without this, calling showToast immediately after dismissToast would cause the new
  // toast to be wiped out 300 ms later by the stale timer.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const dismissToast = useCallback(() => {
    setVisible(false);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setToast(null);
      setActionLoading(false);
      closeTimer.current = null;
    }, 300);
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    // Clear any existing auto-dismiss timer and any pending close timer from dismissToast
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    keyRef.current += 1;
    setToast({ ...opts, key: keyRef.current });
    // Small delay before making visible so CSS transition fires
    setTimeout(() => setVisible(true), 10);

    const duration = opts.duration ?? 4000;
    if (duration > 0) {
      dismissTimer.current = setTimeout(() => {
        setVisible(false);
        closeTimer.current = setTimeout(() => { setToast(null); setActionLoading(false); closeTimer.current = null; }, 300);
      }, duration);
    }
  }, []);

  const handleAction = async () => {
    if (!toast?.action) return;
    const result = toast.action.onClick();
    if (result instanceof Promise) {
      setActionLoading(true);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      try {
        await result;
      } finally {
        dismissToast();
      }
    }
    // If not a Promise, caller handles dismiss themselves
  };

  const duration = toast?.duration ?? 4000;
  const showProgress = duration > 0 && !actionLoading;

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      <style>{`@keyframes mb-toast-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>

      {/* Toast container — always rendered for CSS transition */}
      <div
        aria-live="polite"
        className={`fixed bottom-24 sm:bottom-10 left-1/2 z-[9999] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 transition-all duration-300 ${
          visible && toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        {toast && (
          <div className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-black/90 px-4 py-3 shadow-2xl backdrop-blur-xl ${borderColor(toast.type ?? "info")}`}>
            {/* Icon */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg(toast.type ?? "info")}`}>
              <ToastIcon type={toast.type ?? "info"} />
            </div>

            {/* Message */}
            <p className="text-sm text-white/80">{toast.message}</p>

            {/* Action button */}
            {toast.action && (
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`ml-1 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-60 ${
                  toast.action?.variant === "white"
                    ? "bg-white text-black hover:bg-white/85"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
              >
                {actionLoading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  </span>
                ) : toast.action.label}
              </button>
            )}

            {/* Dismiss button */}
            <button
              onClick={dismissToast}
              disabled={actionLoading}
              className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/40 transition hover:text-white/80 disabled:opacity-50"
              aria-label="ปิด"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Progress bar */}
            {showProgress && (
              <div
                key={toast.key}
                className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${progressColor(toast.type ?? "info")}`}
                style={{ animation: `mb-toast-shrink ${duration}ms linear forwards` }}
              />
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
