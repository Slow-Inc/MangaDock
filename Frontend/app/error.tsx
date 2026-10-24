"use client";

import Link from "next/link";
import StatusPage from "./components/ui/StatusPage";
import Button, { buttonClass } from "./components/ui/Button";
import { usePageTitle } from "./hooks/pageTitle";

/** App-level error boundary: a page that throws gets a way back instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  usePageTitle("หน้านี้มีปัญหา");
  return (
    <StatusPage
      label="error"
      labelTone="danger"
      mascot="error"
      mascotState="sleeping"
      title="หน้านี้มีปัญหา"
      actions={
        <>
          <Button variant="primary" onClick={reset}>
            ลองใหม่
          </Button>
          <Link href="/" className={buttonClass("secondary")}>
            กลับหน้าแรก
          </Link>
        </>
      }
    >
      <p>เกิดข้อผิดพลาดระหว่างแสดงหน้า ลองโหลดใหม่อีกครั้ง ถ้ายังไม่หาย กลับไปหน้าแรกก่อนได้</p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-ink-3">ref {error.digest}</p> : null}
    </StatusPage>
  );
}
