"use client";

import {useState} from "react";
import {useHybridPush} from "../../components/HybridPushProvider";
import Button from "../../components/ui/Button";

export default function NotificationSettings() {
  const {controller, state} = useHybridPush();
  const [notice, setNotice] = useState<string | null>(null);
  const on = state?.status === "on";
  return <section className="space-y-5">
    <div>
      <h2 className="text-base font-semibold text-ink">การแจ้งเตือนบนอุปกรณ์</h2>
      <p className="mt-2 max-w-prose text-sm text-ink-2">รับข่าวตอนใหม่และความเคลื่อนไหวจากคนที่ติดตาม เลือกเปิดรับได้เฉพาะอุปกรณ์นี้</p>
    </div>
    {!controller && !state ? <p className="text-sm text-ink-2">เปิดหน้านี้จากแอป MangaDock รุ่นที่รองรับการแจ้งเตือน</p> : <>
      <p role="status" className="text-sm text-ink">
        {state?.busy ? "กำลังบันทึกการตั้งค่า…" : on ? "เปิดรับแจ้งเตือนแล้ว" : state?.status === "blocked" ? "ยังไม่ได้รับอนุญาต กรุณาอนุญาตการแจ้งเตือนในการตั้งค่า Android แล้วลองอีกครั้ง" : "ปิดรับแจ้งเตือนอยู่"}
      </p>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={!controller || state?.busy} onClick={() => {setNotice(null); void controller?.enable();}} className="min-h-12">{on ? "ตรวจสอบการเชื่อมต่อ" : "เปิดรับแจ้งเตือน"}</Button>
        <Button disabled={!controller || state?.busy} onClick={() => {setNotice(null); void controller?.disable();}} className="min-h-12">ปิดรับแจ้งเตือน</Button>
        <Button disabled={!on || state?.busy} onClick={() => { void controller?.preview().then(() => setNotice("ส่งแจ้งเตือนทดสอบบนอุปกรณ์แล้ว")).catch(() => setNotice("ส่งแจ้งเตือนทดสอบไม่สำเร็จ กรุณาลองอีกครั้ง")); }} className="min-h-12">ทดสอบบนอุปกรณ์</Button>
      </div>
      {notice && <p role="status" className="text-sm text-ink-2">{notice}</p>}
    </>}
  </section>;
}
