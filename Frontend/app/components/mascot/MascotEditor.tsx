"use client";

/**
 * Dress your own mascot and use it as your profile picture (Epic D #785). Everything is free.
 * Save = PUT the config (users/me/mascot) + a still PNG of the preview through the existing avatar
 * upload, written to photo_url — so every place that shows avatars shows the mascot without changes.
 */
import { forwardRef, memo, useCallback, useEffect, useRef, useState } from "react";
import { BotAvatar } from "bot-avatars";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { MASCOT_GLASSES, MASCOT_HATS, MASCOT_TYPES, mascotFromUid, type MascotConfig } from "../../lib/mascot";
import { getMyMascot, saveMyMascot } from "../../lib/mascotApi";
import { useIsScrolling } from "../../hooks/useIsScrolling";
import { useThrottledValue } from "../../hooks/useThrottledValue";
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

/**
 * The body picker. Memoised so a colour drag (one render per input event) does not repaint these
 * 18 still thumbnails — bot-avatars redraws a paused avatar on every render of its parent.
 */
const ShapePicker = memo(function ShapePicker({ selected, onPick }: { selected: MascotConfig["type"]; onPick: (t: MascotConfig["type"]) => void }) {
  return (
    <>
      {MASCOT_TYPES.map((t, i) => (
        <Pill key={t} size="sm" selected={selected === t} onClick={() => onPick(t)} aria-label={t} className="pl-1.5">
          {/* A still thumbnail of each body, so the choice is seen, not guessed from a name. */}
          <BotAvatar type={t} size={22} paused interactive={false} seed={i / MASCOT_TYPES.length} theme="auto" aria-hidden />
          <span className="text-[0.6875rem]">{t}</span>
        </Pill>
      ))}
    </>
  );
});

/**
 * The live preview, memoised: bot-avatars repaints on every render of its parent, so without this each
 * colour-input event repainted the preview twice (urgent render with the old deferred value, then the new).
 */
const Preview = memo(
  forwardRef<HTMLCanvasElement, { config: MascotConfig }>(function Preview({ config }, ref) {
    return <BotAvatar ref={ref} {...config} size={160} theme="auto" aria-label="มาสคอตของคุณ" />;
  }),
);

export default function MascotEditor() {
  const { user, getIdToken, uploadProfilePhoto, updateUserPhotoURL } = useAuth();
  const { showToast } = useToast();
  const [config, setConfig] = useState<MascotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  // The preview follows a throttled copy: a colour change makes bot-avatars re-bake the fur (~50 ms),
  // and a dragged colour picker fires ~60 times a second.
  const preview = useThrottledValue(config, 120);
  // The furred 160 px preview costs a frame budget of its own (/settings ran at ~30 fps with it on
  // screen, 60 without; `paused` does not help — bot-avatars still repaints ~19 times/s). So it is live
  // only while someone is dressing it (pointer over the editor or focus inside it, which covers an open
  // colour picker) and not scrolling; otherwise a still of its last frame stands in and the canvas is
  // display:none, which stops its loop through its IntersectionObserver without a remount (a remount
  // re-bakes the fur and stutters for about a second).
  const box = useRef<HTMLDivElement>(null);
  const engaged = useRef(false);
  const [still, setStill] = useState<{ src: string; left: number; top: number; width: number; height: number } | null>(null);
  const [live, setLive] = useState(true);
  const snapshot = useCallback(() => {
    const c = canvas.current, b = box.current;
    if (!c || !b || c.offsetParent === null) return;
    try {
      const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect();
      setStill({ src: c.toDataURL(), left: cr.left - br.left, top: cr.top - br.top, width: cr.width, height: cr.height });
    } catch {
      /* a tainted canvas cannot be read; stay live */
    }
  }, []);
  const rest = useCallback(() => {
    snapshot();
    setLive(false);
  }, [snapshot]);
  const scrolling = useIsScrolling(200, snapshot);
  // Settle to a still a moment after load, once the fur has baked, unless someone is already editing.
  useEffect(() => {
    if (!preview) return;
    const t = setTimeout(() => {
      if (!engaged.current) rest();
    }, 1500);
    return () => clearTimeout(t);
  }, [preview, rest]);
  const engage = () => {
    engaged.current = true;
    setLive(true);
  };
  const disengage = (e: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    if (e.currentTarget.contains(document.activeElement)) return; // still typing / picking a colour
    engaged.current = false;
    rest();
  };
  const showStill = Boolean(still) && (!live || scrolling);
  // Every edit wakes the preview first: on touch, pointerleave fires right after the tap (before the
  // click's change) and would otherwise leave the still one edit behind.
  const edit = useCallback((next: (c: MascotConfig) => MascotConfig) => {
    setLive(true);
    setConfig((c) => (c ? next(c) : c));
  }, []);
  const pickType = useCallback((type: MascotConfig["type"]) => edit((c) => ({ ...c, type })), [edit]);
  const [canSave, setCanSave] = useState(true);
  const uid = user?.uid;

  // Keyed on the uid, not the user object, so a refreshed user object does not reset unsaved edits.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const token = await getIdToken();
      const res = token ? await getMyMascot(token).catch(() => null) : null;
      if (cancelled) return;
      setConfig(res?.mascot ?? mascotFromUid(uid));
      setCanSave(res?.canSave ?? true);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, getIdToken]);

  if (!user) return null;
  if (!config || !preview) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader context="section" label="กำลังโหลดมาสคอต" className="text-ink-2" />
      </div>
    );
  }

  const set = (patch: Partial<MascotConfig>) => edit((c) => ({ ...c, ...patch }));

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
    <section
      aria-labelledby="mascot-editor-title"
      onPointerEnter={engage}
      onPointerLeave={disengage}
      onFocus={engage}
      onBlur={disengage}
      className="rounded-[var(--r-card)] border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div className="rounded-[var(--r3)] bg-fill p-3">
            <div ref={box} className="relative h-40 w-40">
              {showStill && still ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data-URL still of the canvas, laid exactly over it
                <img src={still.src} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: still.left, top: still.top, width: still.width, height: still.height }} />
              ) : null}
              <div className={showStill ? "hidden" : undefined}>
                <Preview ref={canvas} config={preview} />
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => edit(() => mascotFromUid(`${user.uid}:${Date.now()}`))}>
            สุ่มใหม่
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <h3 id="mascot-editor-title" className="text-base font-semibold text-ink">
            มาสคอตของคุณ
          </h3>
          <p className="mt-1 text-sm text-ink-3">แต่งได้ทุกชิ้นฟรี แล้วใช้เป็นรูปโปรไฟล์แทนรูปจากบัญชีหรือรูปที่อัปโหลด</p>

          <Row label="รูปร่าง">
            <ShapePicker selected={config.type} onPick={pickType} />
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
            <Button variant="primary" onClick={save} disabled={saving || !canSave}>
              {saving ? <Loader context="inline" label="กำลังบันทึก" /> : null}
              ใช้เป็นรูปโปรไฟล์
            </Button>
            {!canSave ? <p className="self-center text-sm text-ink-3">แต่งได้แล้ว แต่ยังบันทึกไม่ได้ — ระบบมาสคอตกำลังเปิดใช้งาน</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
