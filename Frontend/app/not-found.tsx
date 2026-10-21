import Link from "next/link";
import StatusPage from "./components/ui/StatusPage";
import { buttonClass } from "./components/ui/Button";
import { PageTitle } from "./hooks/pageTitle";

export default function NotFound() {
  return (
    <>
    <PageTitle title="ไม่พบหน้านี้" />
    <StatusPage
      label="404"
      mascot="search"
      title="ไม่พบหน้านี้"
      actions={
        <>
          <Link href="/" className={buttonClass("primary")}>
            กลับหน้าแรก
          </Link>
          <Link href="/search" className={buttonClass("secondary")}>
            ค้นหามังงะ
          </Link>
        </>
      }
    >
      ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว ลองกลับหน้าแรก หรือค้นหามังงะที่ตามหาอยู่
    </StatusPage>
    </>
  );
}
