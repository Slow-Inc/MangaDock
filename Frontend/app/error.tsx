"use client";

import Link from "next/link";
import GradientHeading from "./components/ui/GradientHeading";
import Button, { buttonClass } from "./components/ui/Button";

/** App-level error boundary: a page that throws gets a way back instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[var(--max)] flex-col justify-center px-[var(--gutter)] py-24">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-danger">error</p>
      <GradientHeading className="mt-4 text-[clamp(2.3rem,4.1vw,3.9rem)] leading-[1.14]">หน้านี้มีปัญหา</GradientHeading>
      <p className="mt-4 max-w-[34rem] text-[clamp(1.05rem,1.4vw,1.2rem)] text-ink-2">
        เกิดข้อผิดพลาดระหว่างแสดงหน้า ลองโหลดใหม่อีกครั้ง ถ้ายังไม่หาย กลับไปหน้าแรกก่อนได้
      </p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-ink-3">ref {error.digest}</p> : null}
      <div className="mt-9 flex flex-wrap gap-3">
        <Button variant="primary" onClick={reset}>
          ลองใหม่
        </Button>
        <Link href="/" className={buttonClass("secondary")}>
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
