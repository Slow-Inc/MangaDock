import Link from "next/link";
import Navbar from "./components/Navbar";
import GradientHeading from "./components/ui/GradientHeading";
import { buttonClass } from "./components/ui/Button";

export default function NotFound() {
  return (
    <>
    <Navbar />
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[var(--max)] flex-col justify-center px-[var(--gutter)] py-24">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-3">404</p>
      <GradientHeading className="mt-4 text-[clamp(2.3rem,4.1vw,3.9rem)] leading-[1.14]">ไม่พบหน้านี้</GradientHeading>
      <p className="mt-4 max-w-[34rem] text-[clamp(1.05rem,1.4vw,1.2rem)] text-ink-2">
        ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว ลองกลับหน้าแรก หรือค้นหามังงะที่ตามหาอยู่
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        <Link href="/" className={buttonClass("primary")}>
          กลับหน้าแรก
        </Link>
        <Link href="/search" className={buttonClass("secondary")}>
          ค้นหามังงะ
        </Link>
      </div>
    </main>
    </>
  );
}
