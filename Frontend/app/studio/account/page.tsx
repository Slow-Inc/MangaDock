"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { getMyProfile, updateTranslatorProfile } from "../../lib/studioApi";
import { getCached, setCache } from "../../lib/studioCache";
import StudioNav from "../components/StudioNav";
import { useLocalLenis } from "../../hooks/useLocalLenis";

const LANGUAGE_OPTIONS = [
  { code: "th", label: "ไทย" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
];

// ── Custom Language Dropdown ──────────────────────────────────────────────────
function LanguageSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (code: string) => void;
  options: { code: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useLocalLenis(listRef as React.RefObject<HTMLElement | null>, "vertical", open);

  // Detect if dropdown would overflow below viewport → flip upward
  const checkFlip = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 256; // 16rem
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < dropdownHeight + 8);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.code === value);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { checkFlip(); setOpen((p) => !p); }}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors ${
          open
            ? "border-indigo-500 bg-white/8 text-white"
            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
        }`}
      >
        <span>{selected ? selected.label : "-- เลือกภาษา --"}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel — navbar style */}
      <div
        className={`absolute left-0 right-0 z-50 overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-xl backdrop-blur-2xl transition-all duration-200 ease-in-out ${
          dropUp ? "bottom-full mb-1.5 origin-bottom-left" : "top-full mt-1.5 origin-top-left"
        } ${
          open
            ? "pointer-events-auto scale-100 opacity-100 translate-y-0"
            : `pointer-events-none scale-95 opacity-0 ${dropUp ? "translate-y-1" : "-translate-y-1"}`
        }`}
      >
        <ul ref={listRef} className="custom-scrollbar max-h-64 overflow-y-auto py-1">
          <li>
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className={`flex w-full items-center px-4 py-3 text-sm transition hover:bg-white/10 ${
                !value ? "text-indigo-400" : "text-white/70 hover:text-white"
              }`}
            >
              -- เลือกภาษา --
            </button>
          </li>
          {options.map((opt) => {
            const isSelected = opt.code === value;
            return (
              <li key={opt.code}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.code); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-sm transition hover:bg-white/10 ${
                    isSelected ? "text-indigo-400" : "text-white/70 hover:text-white"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function StudioAccountPage() {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  const { showToast } = useToast();

  type ProfileCache = { bio: string; languages: string[]; country: string; preferredLanguage: string };
  const cached = getCached<ProfileCache>("account:profile");

  const [bio, setBio] = useState(cached?.bio ?? "");
  const [languages, setLanguages] = useState<string[]>(cached?.languages ?? []);
  const [country, setCountry] = useState(cached?.country ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(cached?.preferredLanguage ?? "");
  const [loadingProfile, setLoadingProfile] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const hasFetched = useRef(false);
  const originalRef = useRef({ bio: cached?.bio ?? "", languages: cached?.languages ?? [] as string[], country: cached?.country ?? "", preferredLanguage: cached?.preferredLanguage ?? "" });

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      const profile = await getMyProfile(token);
      setBio(profile.bio ?? "");
      setLanguages(profile.translatorLanguages ?? []);
      setCountry(profile.country ?? "");
      setPreferredLanguage(profile.preferredLanguage ?? "");
      const profileData = {
        bio: profile.bio ?? "",
        languages: profile.translatorLanguages ?? [],
        country: profile.country ?? "",
        preferredLanguage: profile.preferredLanguage ?? "",
      };
      originalRef.current = profileData;
      setCache("account:profile", profileData);
    } catch {
      showToast({ type: "error", message: "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้", duration: 3000 });
    } finally {
      setLoadingProfile(false);
    }
  }, [user, getIdToken, showToast]);

  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchProfile();
    }
  }, [user, fetchProfile]);

  // Track changes
  useEffect(() => {
    const orig = originalRef.current;
    const changed =
      bio !== orig.bio ||
      country !== orig.country ||
      preferredLanguage !== orig.preferredLanguage ||
      JSON.stringify(languages) !== JSON.stringify(orig.languages);
    setHasChanges(changed);
  }, [bio, languages, country, preferredLanguage]);

  const toggleLanguage = (code: string) => {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : prev.length < 10 ? [...prev, code] : prev,
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่พบ token");
      await updateTranslatorProfile(token, {
        bio: bio.trim(),
        translatorLanguages: languages,
        country: country.trim(),
        preferredLanguage,
      });
      originalRef.current = { bio: bio.trim(), languages: [...languages], country: country.trim(), preferredLanguage };
      setHasChanges(false);
      setCache("account:profile", { bio: bio.trim(), languages: [...languages], country: country.trim(), preferredLanguage });
      showToast({ type: "success", message: "บันทึกโปรไฟล์สำเร็จ", duration: 2000 });
    } catch (e: unknown) {
      showToast({ type: "error", message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ", duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="pb-[calc(var(--mobile-nav-height)+1.5rem)] text-white md:pb-0">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-4 md:pt-28">
        <div className="pb-4">
          <h1 className="text-xl font-bold">สตูดิโอของฉัน</h1>
          <p className="text-sm text-white/40">อัปโหลดและจัดการงานแปลของคุณ</p>
        </div>

        <StudioNav />

        {loadingProfile ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : (
          <div className="space-y-6 pt-5">
            {/* Profile Header */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600/20">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{user?.displayName ?? "ไม่ระบุชื่อ"}</p>
                <p className="truncate text-sm text-white/40">{user?.email ?? ""}</p>
                <span className="mt-1 inline-block rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                  นักแปล
                </span>
              </div>
            </div>

            {/* Bio */}
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <label className="mb-2 block text-sm font-semibold">แนะนำตัว</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="เล่าเกี่ยวกับตัวคุณให้ผู้อ่านรู้จัก..."
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
              />
              <p className="mt-1 text-right text-[10px] text-white/20">{bio.length}/500</p>
            </div>

            {/* Languages */}
            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <label className="mb-1 block text-sm font-semibold">ภาษาที่แปลได้</label>
              <p className="mb-3 text-xs text-white/30">เลือกภาษาที่คุณสามารถแปลได้ (สูงสุด 10 ภาษา)</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const selected = languages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        selected
                          ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                      }`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Country & Preferred Language */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
                <label className="mb-2 block text-sm font-semibold">ประเทศ</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="เช่น Thailand"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
                <label className="mb-2 block text-sm font-semibold">ภาษาหลัก</label>
                <LanguageSelect
                  value={preferredLanguage}
                  onChange={setPreferredLanguage}
                  options={LANGUAGE_OPTIONS}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    กำลังบันทึก...
                  </span>
                ) : (
                  "บันทึกการเปลี่ยนแปลง"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
