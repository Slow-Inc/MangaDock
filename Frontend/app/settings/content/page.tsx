"use client";

/**
 * Settings → เนื้อหา (#1102, PRD #1100): the account's 18+ level. Raising it asks once for what is missing — the age
 * confirmation for 18+, and also the Terms for "ทั้งหมด" (pornographic); the server enforces the same gate. Lowering
 * it saves at once.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useModalDialog } from "../../hooks/useDialogFocus";
import { setContentLevel, type ContentLevel } from "../../lib/contentLevel";
import { getContentSettings, saveContentSettings, type ContentSettings } from "../../lib/contentSettingsApi";
import Loader from "../../components/ui/Loader";
import { PRIMARY_FILL } from "../../components/ui/Button";

const OPTIONS: { level: ContentLevel; title: string; detail: string }[] = [
  { level: "off", title: "ปิด", detail: "แสดงเฉพาะเนื้อหาทั่วไป (ค่าเริ่มต้น)" },
  { level: "erotica", title: "18+", detail: "รวมเนื้อหาสำหรับผู้ใหญ่ (erotica)" },
  { level: "all", title: "ทั้งหมด", detail: "รวมเนื้อหาลามกอนาจาร (pornographic) — ต้องยอมรับข้อตกลง" },
];
const RANK: Record<ContentLevel, number> = { off: 0, erotica: 1, all: 2 };

function ConfirmDialog({
  target, needAge, needTos, saving, onCancel, onConfirm,
}: {
  target: ContentLevel; needAge: boolean; needTos: boolean; saving: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalDialog(ref, onCancel);
  const [age, setAge] = useState(!needAge);
  const [tos, setTos] = useState(!needTos);
  return createPortal(
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={needTos ? "ข้อตกลงการเข้าถึงเนื้อหา" : "ยืนยันอายุ"}
      className="fixed inset-0 z-300 flex items-center justify-center p-4 outline-none">
      <div className="absolute inset-0 bg-scrim/80" onClick={onCancel} />
      <div className="relative w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-ink">
          {target === "all" ? "เปิดเนื้อหาทั้งหมด" : "เปิดเนื้อหา 18+"}
        </h2>
        {needTos && (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-line bg-fill p-4 text-xs leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">ข้อตกลงการเข้าถึงเนื้อหาลามกอนาจาร</p>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>เนื้อหาระดับนี้มาจากบริการภายนอก (MangaDex) MangaDock ไม่ได้ผลิต ไม่ได้อัปโหลด และไม่ได้คัดกรองเนื้อหาเหล่านี้</li>
              <li>MangaDock ไม่มีส่วนเกี่ยวข้องและไม่รับผิดชอบต่อเนื้อหาดังกล่าว</li>
              <li>คุณยืนยันว่าอายุ 18 ปีขึ้นไป และการเข้าถึงเนื้อหานี้ไม่ผิดกฎหมายในพื้นที่ที่คุณอยู่</li>
              <li>คุณรับผิดชอบการเข้าถึงและการใช้งานเนื้อหานี้ด้วยตนเอง</li>
              <li>ปิดการตั้งค่านี้ได้ทุกเมื่อในหน้านี้</li>
            </ul>
          </div>
        )}
        {needAge && (
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
            ฉันอายุ 18 ปีขึ้นไป
          </label>
        )}
        {needTos && (
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
            ฉันอ่านและยอมรับข้อตกลงข้างต้น
          </label>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-ink-2 transition hover:bg-fill hover:text-ink">ยกเลิก</button>
          <button type="button" onClick={onConfirm} disabled={!age || !tos || saving}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${PRIMARY_FILL}`}>
            {saving && <Loader context="inline" />}
            ยืนยัน
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ContentSettingsPage() {
  const { getIdToken } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<ContentSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<ContentLevel | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await getIdToken();
      if (!token) return;
      try { setSettings(await getContentSettings(token)); } catch { setFailed(true); }
    })();
  }, [getIdToken]);

  const save = useCallback(async (level: ContentLevel, confirm: { confirmAge?: boolean; acceptTos?: boolean } = {}) => {
    const token = await getIdToken();
    if (!token) return;
    setSaving(true);
    try {
      const next = await saveContentSettings(token, { level, ...confirm });
      setSettings(next);
      setContentLevel(next.level);
      setPending(null);
      showToast({ type: "success", message: "บันทึกการตั้งค่าเนื้อหาแล้ว" });
    } catch {
      showToast({ type: "error", message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setSaving(false);
    }
  }, [getIdToken, showToast]);

  const choose = (level: ContentLevel) => {
    if (!settings || level === settings.level) return;
    const needAge = level !== "off" && !settings.ageConfirmedAt;
    const needTos = level === "all" && !settings.tosAcceptedAt;
    if (RANK[level] > RANK[settings.level] && (needAge || needTos)) setPending(level);
    else void save(level);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">เนื้อหา</h2>
        <p className="mt-1 text-xs text-ink-3">เลือกระดับเนื้อหาที่แสดงในการค้นหา หมวดหมู่ และรายการตอน หน้าแรกแสดงเฉพาะเนื้อหาทั่วไปเสมอ</p>
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-danger">โหลดการตั้งค่าไม่สำเร็จ ลองรีเฟรชหน้านี้</p>
      ) : !settings ? (
        <Loader context="section" />
      ) : (
        <fieldset className="space-y-2" disabled={saving}>
          <legend className="sr-only">ระดับเนื้อหา</legend>
          {OPTIONS.map((o) => (
            <label key={o.level}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${settings.level === o.level ? "border-accent/50 bg-accent/10" : "border-line bg-fill hover:border-ink-3"}`}>
              <input type="radio" name="content-level" value={o.level} checked={settings.level === o.level}
                onChange={() => choose(o.level)} className="mt-1 h-4 w-4 accent-accent" />
              <span>
                <span className="block text-sm font-semibold text-ink">{o.title}</span>
                <span className="block text-xs text-ink-3">{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {pending && settings && (
        <ConfirmDialog
          target={pending}
          needAge={pending !== "off" && !settings.ageConfirmedAt}
          needTos={pending === "all" && !settings.tosAcceptedAt}
          saving={saving}
          onCancel={() => setPending(null)}
          onConfirm={() => void save(pending, {
            confirmAge: pending !== "off" ? true : undefined,
            acceptTos: pending === "all" ? true : undefined,
          })}
        />
      )}
    </div>
  );
}
