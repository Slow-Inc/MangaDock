"use client";

/**
 * Choose the profile picture (Epic D #785): a linked account's photo, an upload, or the mascot (dressed
 * in MascotEditor below, which saves its own still PNG). Uploads go through AuthContext's
 * uploadProfilePhoto (POST /users/me/avatar); every choice ends in updateUserPhotoURL.
 */
import { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { avatarFileError, oauthPhotoChoices, safeImageUrl } from "../../lib/profilePhoto";
import { errMessage } from "@/lib/errMessage";
import { UidMascot } from "../mascot/Mascot";
import { pillClass } from "../ui/Pill";
import Loader from "../ui/Loader";

export default function ProfilePhotoPicker() {
  const { user, uploadProfilePhoto, updateUserPhotoURL } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const current = safeImageUrl(user.photoURL);
  const oauth = oauthPhotoChoices(user.providerData, user.photoURL);

  const apply = async (getUrl: () => Promise<string>, done: string) => {
    setBusy(true);
    try {
      await updateUserPhotoURL(await getUrl());
      showToast({ type: "success", message: done, duration: 3000 });
    } catch (e) {
      showToast({ type: "error", message: errMessage(e) || "เปลี่ยนรูปโปรไฟล์ไม่สำเร็จ", duration: 4000 });
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again still fires change
    if (!file) return;
    const problem = avatarFileError(file);
    if (problem) {
      showToast({ type: "error", message: problem, duration: 4000 });
      return;
    }
    void apply(() => uploadProfilePhoto(file), "อัปโหลดรูปโปรไฟล์แล้ว");
  };

  return (
    <section aria-labelledby="profile-photo-title" className="rounded-[var(--r-card)] border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-fill">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element -- an OAuth or uploaded photo from any host
            <img src={current} alt="รูปโปรไฟล์ปัจจุบัน" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <UidMascot uid={user.uid} size={44} />
          )}
        </div>
        <div className="min-w-0">
          <h3 id="profile-photo-title" className="text-base font-semibold text-ink">
            รูปโปรไฟล์
          </h3>
          <p className="mt-1 text-sm text-ink-3">ใช้รูปจากบัญชีที่เชื่อมไว้ อัปโหลดรูปเอง หรือแต่งมาสคอตด้านล่าง</p>
        </div>
        {busy ? <Loader context="inline" label="กำลังเปลี่ยนรูปโปรไฟล์" className="ml-auto text-ink-2" /> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {oauth.map((c) => (
          <button
            key={c.url}
            type="button"
            disabled={busy || c.active}
            aria-pressed={c.active}
            onClick={() => void apply(async () => c.url, `ใช้รูปจาก ${c.label} แล้ว`)}
            className={pillClass(c.active, "sm", "pl-1.5 disabled:cursor-default")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- an OAuth CDN photo */}
            <img src={c.url} alt="" aria-hidden className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
            {c.active ? `ใช้รูปจาก ${c.label} อยู่` : `ใช้รูปจาก ${c.label}`}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className={pillClass(false, "sm", "disabled:opacity-45")}>
          อัปโหลดรูป
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFile}
          className="hidden"
          aria-label="อัปโหลดรูปโปรไฟล์"
        />
        <a href="#mascot-editor" className={pillClass(false, "sm")}>
          ใช้มาสคอต
        </a>
      </div>
      {oauth.length === 0 ? <p className="mt-2 text-xs text-ink-3">บัญชีนี้ไม่มีรูปจาก Google หรือ Facebook ให้เลือก</p> : null}
    </section>
  );
}
