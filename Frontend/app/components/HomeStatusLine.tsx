"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Server-side detection from SSR/ISR — used as initial state before client check finishes */
  serverUnavailable: boolean;
  /** If the server response had fromStaleCache, pass the timestamp here */
  staleTimestamp?: string;
};

function formatThaiTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type Status =
  | { kind: "ok" }
  | { kind: "backend-down"; at: Date }
  | { kind: "api-stale"; timestamp: string };

export default function HomeStatusLine({ serverUnavailable, staleTimestamp }: Props) {
  const [status, setStatus] = useState<Status>(
    serverUnavailable
      ? { kind: "backend-down", at: new Date() }
      : staleTimestamp
        ? { kind: "api-stale", timestamp: staleTimestamp }
        : { kind: "ok" },
  );

  useEffect(() => {
    const ctrl = new AbortController();

    fetch("/api/proxy/books/landing", { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) {
          setStatus({ kind: "backend-down", at: new Date() });
          return;
        }
        const data = await res.json();
        if (data.fromStaleCache) {
          setStatus({
            kind: "api-stale",
            timestamp: data.staleUpdatedAt ?? data.updatedAt,
          });
        } else {
          setStatus({ kind: "ok" });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus({ kind: "backend-down", at: new Date() });
      });

    return () => ctrl.abort();
  }, []);

  if (status.kind === "ok") return null;

  const badgeText = "CAUTION";
  const text =
    status.kind === "backend-down"
      ? `ไม่สามารถเชื่อมต่อ backend ได้เมื่อเวลา ${formatThaiTime(status.at)}น.`
      : `MangaDex API ใช้งานไม่ได้ชั่วคราว · ข้อมูลอัปเดตล่าสุด ${formatThaiTime(status.timestamp)}น.`;

  return (
    <div className="mx-auto max-w-5xl px-1">
      <p className="flex items-center justify-center gap-2 text-center text-[11px] leading-relaxed tracking-[0.06em] text-white/45 sm:justify-start sm:text-left sm:text-sm sm:tracking-[0.14em]">
        <span
          aria-hidden="true"
          className="inline-flex h-5 items-center justify-center rounded-full border border-amber-300/45 px-2 text-[9px] font-semibold leading-none tracking-[0.14em] text-amber-200"
        >
          {badgeText}
        </span>
        <span>{text}</span>
      </p>
    </div>
  );
}
