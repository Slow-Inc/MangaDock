"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../../contexts/AuthContext";
import { useTopupStream } from "../../../hooks/useTopupStream";
import { cancelTopup, simulateTopup, getTopupStatus } from "../../../lib/studioApi";
import { errMessage } from "@/lib/errMessage";

function formatCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function TopupPaymentContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentId = params.paymentId as string;
  const returnTo = searchParams.get("returnTo");

  const { user, loading, getIdToken, showLoginPrompt } = useAuth();

  const [qrString, setQrString] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loadingQr, setLoadingQr] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState("");

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      showLoginPrompt();
      router.replace("/");
    }
  }, [loading, user, showLoginPrompt, router]);

  // Load QR from sessionStorage (written by /wallet/topup on create),
  // with a getTopupStatus fallback for already-paid / unknown IDs.
  useEffect(() => {
    if (loading || !user) return;
    const stored = sessionStorage.getItem(`topup:${paymentId}`);
    if (stored) {
      try {
        const { qrString: qs, expiresAt: ea } = JSON.parse(stored) as {
          qrString: string;
          expiresAt: string;
        };
        setQrString(qs);
        setExpiresAt(new Date(ea));
        setLoadingQr(false);
        return;
      } catch {}
    }
    // Fallback: no stored QR (e.g. hard-refresh or direct navigation)
    getIdToken().then(async (token) => {
      if (!token) { router.replace("/wallet/topup"); return; }
      try {
        const { status, balance } = await getTopupStatus(token, paymentId);
        if (status === "paid" && balance !== undefined) {
          // Already paid — useTopupStream will immediately enter paid state
          // via visibilitychange / SSE; we just need to stay on this page.
          // Nothing to show for QR, stream handles the success transition.
        } else {
          // Unknown ID or expired — nothing to display, redirect to start
          router.replace("/wallet/topup");
        }
      } catch {
        router.replace("/wallet/topup");
      } finally {
        setLoadingQr(false);
      }
    });
  }, [loading, user, paymentId, getIdToken, router]);

  const { countdown, status, successBalance } = useTopupStream(
    paymentId,
    expiresAt,
    getIdToken,
  );

  // Redirect after success
  useEffect(() => {
    if (status !== "paid" || successBalance === null) return;
    sessionStorage.removeItem(`topup:${paymentId}`);
    const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/wallet";
    const id = setTimeout(() => router.replace(dest), 1500);
    return () => clearTimeout(id);
  }, [status, successBalance, paymentId, returnTo, router]);

  const handleCancel = async () => {
    try {
      const token = await getIdToken();
      if (token) await cancelTopup(token, paymentId);
    } catch {}
    sessionStorage.removeItem(`topup:${paymentId}`);
    router.push("/wallet/topup");
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setSimError("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่ได้เข้าสู่ระบบ");
      await simulateTopup(token, paymentId);
    } catch (err) {
      setSimError(errMessage(err));
    } finally {
      setSimulating(false);
    }
  };

  if (loading || !user) return null;

  if (loadingQr) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#111] p-4">
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <h1 className="text-sm font-bold text-white">สแกน QR เพื่อชำระเงิน</h1>
        </div>

        <div className="flex flex-col items-center gap-3 p-5">
          {status === "paid" ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-3xl text-green-400">
                ✓
              </div>
              <p className="text-base font-bold text-white">ชำระเงินสำเร็จ</p>
              {successBalance !== null && (
                <>
                  <p className="text-2xl font-bold text-amber-300">
                    🪙 {successBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/40">ยอดเหรียญปัจจุบัน</p>
                </>
              )}
              <p className="text-xs text-white/40">กำลังกลับ...</p>
            </>
          ) : (
            <>
              <p className="text-xs text-white/40">สแกน QR ด้วยแอปธนาคาร</p>
              <div
                className={`rounded-xl bg-white p-3 transition-all duration-300 ${
                  status === "expired" ? "opacity-25 blur-sm" : ""
                }`}
              >
                {qrString && <QRCodeSVG value={qrString} size={180} />}
              </div>

              {status === "pending" && (
                <>
                  <p className="font-mono text-sm text-amber-300">
                    ⏱ {formatCountdown(countdown)}
                  </p>
                  {process.env.NODE_ENV !== "production" && (
                    <button
                      onClick={handleSimulate}
                      disabled={simulating}
                      className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-40"
                    >
                      {simulating ? "กำลังจำลอง..." : "⚡ จำลองการชำระ"}
                    </button>
                  )}
                  {simError && <p className="text-xs text-red-400">{simError}</p>}
                  <button
                    onClick={handleCancel}
                    className="text-xs text-white/30 transition hover:text-white/60"
                  >
                    ยกเลิก
                  </button>
                </>
              )}

              {status === "expired" && (
                <>
                  <p className="text-xs text-red-400">QR หมดอายุแล้ว</p>
                  <button
                    onClick={() => router.push("/wallet/topup")}
                    className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
                  >
                    สร้าง QR ใหม่
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function TopupPaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#111]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </main>
      }
    >
      <TopupPaymentContent />
    </Suspense>
  );
}
