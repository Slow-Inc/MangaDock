"use client";

/**
 * Dress your own mascot and use it as your profile picture (Epic D #785). Everything is free.
 * Save = PUT the config (users/me/mascot) + a still PNG of the preview through the existing avatar
 * upload, written to photo_url — so every place that shows avatars shows the mascot without changes.
 */
import { useEffect, useRef, useState } from "react";
import { BotAvatar } from "bot-avatars";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { MASCOT_GLASSES, MASCOT_HATS, MASCOT_TYPES, mascotFromUid, type MascotConfig } from "../../lib/mascot";
import { getMyMascot, saveMyMascot } from "../../lib/mascotApi";
import Pill from "../ui/Pill";
import Button from "../ui/Button";
import Loader from "../ui/Loader";

const HAT_LABEL: Record<(typeof MASCOT_HATS)[number], string> = { none: "ไม่ใส่", beret: "เบเร่ต์", beanie: "บีนนี่", party: "ปาร์ตี้", crown: "มงกุฎ" };
const GLASSES_LABEL: Record<(typeof MASCOT_GLASSES)[number], string> = { none: "ไม่ใส่", round: "กลม", square: "เหลี่ยม", shades: "กันแดด" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-line py-4 sm:grid-cols-[8rem,1fr] sm:items-center">
      <p className="text-sm text-ink-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function MascotEditor() {
  const { user, getIdToken, uploadProfilePhoto, updateUserPhotoURL } = useAuth();
  const { showToast } = useToast();
  const [config, setConfig] = useState<MascotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const token = await getIdToken();
      const saved = token ? await getMyMascot(token).catch(() => null) : null;
      if (!cancelled) setConfig(saved ?? mascotFromUid(user.uid));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getIdToken]);

  if (!user) return null;
  if (!config) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader context="section" label="กำลังโหลดมาสคอต" className="text-ink-2" />
      </div>
    );
  }

  const set = (patch: Partial<MascotConfig>) => setConfig({ ...config, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      await saveMyMascot(token, config);
      const blob: Blob | null = await new Promise((resolve) => canvas.current?.toBlob(resolve, "image/png") ?? resolve(null));
      if (!blob) throw new Error("สร้างรูปมาสคอตไม่สำเร็จ");
      const url = await uploadProfilePhoto(new File([blob], "mascot.png", { type: "image/png" }));
      await updateUserPhotoURL(url);
      showToast({ type: "success", message: "ใช้มาสคอตเป็นรูปโปรไฟล์แล้ว", duration: 3000 });
    } catch (e) {
      showToast({ type: "error", message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ", duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="mascot-editor-title" className="rounded-[var(--r-card)] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div className="rounded-[var(--r3)] bg-fill p-3">
            <BotAvatar ref={canvas} {...config} size={160} theme="auto" aria-label="มาสคอตของคุณ" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setConfig(mascotFromUid(`${user.uid}:${Date.now()}`))}>
            สุ่มใหม่
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <h3 id="mascot-editor-title" className="text-base font-semibold text-ink">
            มาสคอตของคุณ
          </h3>
          <p className="mt-1 text-sm text-ink-3">แต่งได้ทุกชิ้นฟรี แล้วใช้เป็นรูปโปรไฟล์แทนรูปจากบัญชีหรือรูปที่อัปโหลด</p>

          <Row label="รูปร่าง">
            {MASCOT_TYPES.map((t, i) => (
              <Pill key={t} size="sm" selected={config.type === t} onClick={() => set({ type: t })} aria-label={t} className="pl-1.5">
                {/* A still thumbnail of each body, so the choice is seen, not guessed from a name. */}
                <BotAvatar type={t} size={22} paused interactive={false} seed={i / MASCOT_TYPES.length} theme="auto" aria-hidden />
                <span className="text-[0.6875rem]">{t}</span>
              </Pill>
            ))}
          </Row>
          <Row label="หน้า">
            <Pill size="sm" selected={config.face === "eyes"} onClick={() => set({ face: "eyes" })}>ตาอย่างเดียว</Pill>
            <Pill size="sm" selected={config.face === "mouth"} onClick={() => set({ face: "mouth" })}>มีปาก</Pill>
          </Row>
          <Row label="หมวก">
            {MASCOT_HATS.map((h) => (
              <Pill key={h} size="sm" selected={config.hat === h} onClick={() => set({ hat: h })}>{HAT_LABEL[h]}</Pill>
            ))}
          </Row>
          <Row label="แว่น">
            {MASCOT_GLASSES.map((g) => (
              <Pill key={g} size="sm" selected={config.glasses === g} onClick={() => set({ glasses: g })}>{GLASSES_LABEL[g]}</Pill>
            ))}
          </Row>
          <Row label="ของเสริม">
            <Pill size="sm" selected={config.headphones} onClick={() => set({ headphones: !config.headphones })}>หูฟัง</Pill>
            <Pill size="sm" selected={config.bowTie} onClick={() => set({ bowTie: !config.bowTie })}>โบว์</Pill>
          </Row>
          <Row label="สี">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              ตัว
              <input type="color" value={config.color ?? "#ff8c42"} onChange={(e) => set({ color: e.target.value })} className="h-8 w-10 cursor-pointer rounded-[var(--r1)] border border-line bg-transparent" />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              ของสวม
              <input type="color" value={config.accessoryColor ?? "#222222"} onChange={(e) => set({ accessoryColor: e.target.value })} className="h-8 w-10 cursor-pointer rounded-[var(--r1)] border border-line bg-transparent" />
            </label>
            {config.color || config.accessoryColor ? (
              <Button variant="ghost" size="sm" onClick={() => set({ color: undefined, accessoryColor: undefined })}>ใช้สีเดิมของตัว</Button>
            ) : null}
          </Row>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? <Loader context="inline" label="กำลังบันทึก" /> : null}
              ใช้เป็นรูปโปรไฟล์
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
