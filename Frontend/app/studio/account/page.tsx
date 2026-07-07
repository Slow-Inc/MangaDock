"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Navbar from "../../components/Navbar";

import LoadingScreen from "../../components/LoadingScreen";
import { useProtectedPage } from "../../hooks/useProtectedPage";
import { useToast } from "../../contexts/ToastContext";
import { getMyProfile, updateTranslatorProfile } from "../../lib/studioApi";
import { getCached, setCache } from "../../lib/studioCache";
import StudioNav from "../components/StudioNav";
import { StudioAccountSkeleton } from "../components/StudioSkeleton";
import { MetricCard, StudioAnnouncement, StudioSection } from "../components/StudioDashboardWidgets";
import {
  StudioMobileHeader,
  StudioMobileHero,
  StudioMobileMenuCard,
  StudioMobileSection,
} from "../components/StudioMobileShell";
import { StudioSelect } from "../components/StudioSelect";
import { CountrySelect } from "../components/CountrySelect";
import { getAccountProfileCompleteness } from "../lib/dashboardAnalytics";
import { useIsMobile } from "../../hooks/useIsMobile";

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

type AccountMobileView = "menu" | "bio" | "languages" | "identity" | "guide";

function LanguageSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (code: string) => void;
  options: { code: string; label: string }[];
}) {
  return (
    <StudioSelect
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: "-- เลือกภาษา --" },
        ...options.map((option) => ({ value: option.code, label: option.label })),
      ]}
    />
  );
}

export default function StudioAccountPage() {
  const { user, loading, getIdToken } = useProtectedPage();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  type ProfileCache = { bio: string; languages: string[]; country: string; preferredLanguage: string };
  const cached = getCached<ProfileCache>("account:profile");

  const [bio, setBio] = useState(cached?.bio ?? "");
  const [languages, setLanguages] = useState<string[]>(cached?.languages ?? []);
  const [country, setCountry] = useState(cached?.country ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(cached?.preferredLanguage ?? "");
  const [loadingProfile, setLoadingProfile] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [mobileView, setMobileView] = useState<AccountMobileView>("menu");
  const mobileMenuScrollRef = useRef(0);
  const shouldRestoreMenuScrollRef = useRef(false);
  const hasFetched = useRef(false);
  const originalRef = useRef({ bio: cached?.bio ?? "", languages: cached?.languages ?? [] as string[], country: cached?.country ?? "", preferredLanguage: cached?.preferredLanguage ?? "" });
  const profileCompleteness = useMemo(
    () => getAccountProfileCompleteness({
      bio,
      languages,
      country,
      preferredLanguage,
      hasPhoto: Boolean(user?.photoURL),
    }),
    [bio, languages, country, preferredLanguage, user?.photoURL],
  );

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

  useEffect(() => {
    if (loadingProfile) return;

    let frame = 0;
    let timer = 0;
    const notifyLayoutChange = () => window.dispatchEvent(new Event("resize"));

    frame = requestAnimationFrame(notifyLayoutChange);
    timer = window.setTimeout(notifyLayoutChange, 180);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [loadingProfile]);

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

  const openMobileProfileSection = (view: Exclude<AccountMobileView, "menu">) => {
    mobileMenuScrollRef.current = window.scrollY;
    shouldRestoreMenuScrollRef.current = false;
    setMobileView(view);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const returnToMobileMenu = () => {
    shouldRestoreMenuScrollRef.current = true;
    setMobileView("menu");
  };

  useEffect(() => {
    if (!isMobile || mobileView !== "menu" || !shouldRestoreMenuScrollRef.current) return;

    let frame1 = 0;
    let frame2 = 0;
    const restore = () => {
      window.scrollTo({ top: mobileMenuScrollRef.current, behavior: "auto" });
      shouldRestoreMenuScrollRef.current = false;
    };

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(restore);
    });

    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [isMobile, mobileView]);

  if (loading) return <LoadingScreen />;

  if (isMobile) {
    const saveButton = (
      <button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? "กำลังบันทึก..." : hasChanges ? "บันทึกการเปลี่ยนแปลง" : "ข้อมูลล่าสุดแล้ว"}
      </button>
    );

    const renderMobileContent = () => {
      if (loadingProfile) {
        return <StudioAccountSkeleton />;
      }

      if (mobileView === "menu") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioAnnouncement />
            <StudioMobileHero
              eyebrow="Translator Profile"
              title="ข้อมูลนักแปล"
              description="บนมือถือเราจะแยกการแก้โปรไฟล์ออกเป็นหน้าจอย่อย คล้าย account modal ของระบบหลัก"
              aside={(
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-right">
                  <p className="text-[10px] text-white/45">สมบูรณ์</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-300">{profileCompleteness.percent}%</p>
                </div>
              )}
            />

            <div className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/4 p-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600/20">
                {user?.photoURL ? (
                  <Image src={user.photoURL} alt="" fill className="object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{user?.displayName ?? "ไม่ระบุชื่อ"}</p>
                <p className="truncate text-xs text-white/40">{user?.email ?? ""}</p>
                <p className="mt-1 text-[11px] text-white/30">กรอกแล้ว {profileCompleteness.completed}/{profileCompleteness.total} หมวดหลัก</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="ภาษาแปลได้" value={languages.length} hint="สูงสุด 10 ภาษา" tone="indigo" />
              <MetricCard label="ภาษาหลัก" value={preferredLanguage ? preferredLanguage.toUpperCase() : "-"} hint="ค่าเริ่มต้นของโปรไฟล์" tone="sky" />
              <MetricCard label="ประเทศ" value={country || "-"} hint="แสดงในโปรไฟล์" tone="violet" />
              <MetricCard label="สถานะ" value={hasChanges ? "มีการแก้ไข" : "ล่าสุด"} hint={hasChanges ? "ยังไม่บันทึก" : "ตรงกับระบบ"} tone={hasChanges ? "amber" : "emerald"} />
            </div>

            <StudioMobileSection title="จัดการโปรไฟล์" subtitle="แยกหัวข้อเป็นหน้าย่อยเพื่อให้อ่านและแก้ง่ายบนมือถือ">
              <div className="space-y-3">
                <StudioMobileMenuCard
                  icon={<span className="text-lg">✍️</span>}
                  title="แนะนำตัว"
                  description="เขียน bio และแนะนำแนวทางการแปลของคุณ"
                  value={`${bio.length}/500`}
                  tone="indigo"
                  onClick={() => openMobileProfileSection("bio")}
                />
                <StudioMobileMenuCard
                  icon={<span className="text-lg">🌐</span>}
                  title="ภาษาที่แปลได้"
                  description="เลือกภาษาที่ถนัดและใช้ทำงานจริง"
                  value={`${languages.length} ภาษา`}
                  tone="emerald"
                  onClick={() => openMobileProfileSection("languages")}
                />
                <StudioMobileMenuCard
                  icon={<span className="text-lg">⚙️</span>}
                  title="ข้อมูลหลัก"
                  description="ประเทศและภาษาหลักของบัญชี"
                  value={country || "ยังไม่ตั้ง"}
                  tone="amber"
                  onClick={() => openMobileProfileSection("identity")}
                />
                <StudioMobileMenuCard
                  icon={<span className="text-lg">💡</span>}
                  title="คำแนะนำ"
                  description="แนวทางทำให้โปรไฟล์พร้อมใช้งานและครบถ้วน"
                  tone="default"
                  onClick={() => openMobileProfileSection("guide")}
                />
              </div>
            </StudioMobileSection>

            {saveButton}
          </div>
        );
      }

      if (mobileView === "bio") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioMobileHeader title="แนะนำตัว" subtitle="เขียน bio แบบอ่านง่ายบนมือถือ" onBack={returnToMobileMenu} />
            <StudioMobileSection title="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="เล่าเกี่ยวกับตัวคุณให้ผู้อ่านรู้จัก..."
                rows={9}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
              />
              <p className="mt-2 text-right text-[11px] text-white/25">{bio.length}/500</p>
            </StudioMobileSection>
            {saveButton}
          </div>
        );
      }

      if (mobileView === "languages") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioMobileHeader title="ภาษาที่แปลได้" subtitle="เลือกภาษาแบบเต็มหน้าจอบนมือถือ" onBack={returnToMobileMenu} />
            <StudioMobileSection title="รายการภาษา" subtitle="เลือกได้สูงสุด 10 ภาษา">
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const selected = languages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`rounded-2xl border px-3 py-2 text-xs font-medium transition ${
                        selected
                          ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                          : "border-white/10 bg-white/5 text-white/55"
                      }`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </StudioMobileSection>
            {saveButton}
          </div>
        );
      }

      if (mobileView === "identity") {
        return (
          <div className="space-y-4 px-4 py-4">
            <StudioMobileHeader title="ข้อมูลหลัก" subtitle="ตั้งประเทศและภาษาหลักของบัญชี" onBack={returnToMobileMenu} />
            <StudioMobileSection title="ประเทศ">
              <CountrySelect
                value={country}
                onChange={setCountry}
                placeholder="ค้นหาหรือเลือกประเทศ..."
              />
            </StudioMobileSection>
            <StudioMobileSection title="ภาษาหลัก">
              <LanguageSelect
                value={preferredLanguage}
                onChange={setPreferredLanguage}
                options={LANGUAGE_OPTIONS}
              />
            </StudioMobileSection>
            {saveButton}
          </div>
        );
      }

      return (
        <div className="space-y-4 px-4 py-4">
          <StudioMobileHeader title="คำแนะนำ" subtitle="แนวทางทำให้โปรไฟล์พร้อมใช้งาน" onBack={returnToMobileMenu} />
          <StudioMobileSection title="ข้อมูลเพิ่มเติม" subtitle="สรุปจากแนวทางการตั้งค่าโปรไฟล์นักแปล">
            <div className="space-y-4 text-sm leading-6 text-white/60">
              <p>กรอก bio ให้ชัดเจนเพื่อช่วยให้ผู้อ่านรู้จักแนวทางการแปลของคุณมากขึ้น</p>
              <p>เลือกภาษาที่แปลได้ให้ครบ เพราะข้อมูลนี้สามารถนำไปใช้กับระบบค้นหานักแปลหรือ matching ในอนาคตได้</p>
              <p>ตั้งค่าภาษาหลักเพื่อใช้เป็นค่าเริ่มต้นในเครื่องมือ Studio และให้ทีมงานตีความโปรไฟล์ได้ตรงขึ้น</p>
              <p>ถ้าอยากให้หน้าโปรไฟล์พร้อมใช้งานจริง ควรมีรูปโปรไฟล์ ประเทศ และอย่างน้อย 1 ภาษาแปล</p>
            </div>
          </StudioMobileSection>
        </div>
      );
    };

    return (
      <div className="pb-[calc(var(--mobile-nav-height)+1.75rem+env(safe-area-inset-bottom))] text-white">
        <Navbar />
        <div className="pt-[calc(4.9rem+env(safe-area-inset-top))]">
          {renderMobileContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[calc(var(--mobile-nav-height)+1.5rem)] text-white md:pb-0">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-6 pt-[calc(5.5rem+env(safe-area-inset-top))] md:pt-28">
        <div className="space-y-5">
          <StudioAnnouncement />

          <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-white/35">Translator Profile</p>
                <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">ข้อมูลนักแปล</h1>
                <p className="mt-2 text-sm text-white/45">จัดการความพร้อมของโปรไฟล์ ภาษา และข้อมูลหลักของบัญชีในสไตล์ dashboard นักเขียน</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3">
                <p className="text-xs text-white/45">ความสมบูรณ์ของโปรไฟล์</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">{profileCompleteness.percent}%</p>
              </div>
            </div>
          </div>

          <StudioNav />

          {loadingProfile ? (
            <StudioAccountSkeleton />
          ) : (
            <div className="space-y-6">
              <StudioSection title="สถานะบัญชี" subtitle="มุมมองเดียวกับหน้าข้อมูลนักเขียน แต่ผูกกับข้อมูล profile ของ MetaBooks">
                <div className="space-y-4">
                  <div className={`rounded-2xl border px-4 py-4 ${profileCompleteness.percent >= 80 ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
                    <p className={`text-sm font-medium ${profileCompleteness.percent >= 80 ? "text-emerald-300" : "text-amber-300"}`}>
                      {profileCompleteness.percent >= 80
                        ? "โปรไฟล์นักแปลของคุณพร้อมใช้งาน"
                        : "โปรไฟล์ยังกรอกไม่ครบ แนะนำให้เติมข้อมูลให้สมบูรณ์"}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      กรอกแล้ว {profileCompleteness.completed}/{profileCompleteness.total} หมวดหลัก
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="ภาษาแปลได้" value={languages.length} hint="เลือกได้สูงสุด 10 ภาษา" tone="indigo" />
                    <MetricCard label="ภาษาหลัก" value={preferredLanguage ? preferredLanguage.toUpperCase() : "-"} hint="ใช้เป็นภาษาหลักของโปรไฟล์" tone="sky" />
                    <MetricCard label="ประเทศ" value={country || "-"} hint="แสดงในโปรไฟล์สาธารณะ" tone="violet" />
                    <MetricCard label="สถานะการบันทึก" value={hasChanges ? "มีการแก้ไข" : "ล่าสุด"} hint={hasChanges ? "ยังไม่ได้บันทึก" : "ข้อมูลตรงกับระบบ"} tone={hasChanges ? "amber" : "emerald"} />
                  </div>
                </div>
              </StudioSection>

              <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
                <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600/20">
                {user?.photoURL ? (
                  <Image src={user.photoURL} alt="" fill className="object-cover" />
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
                <CountrySelect
                  value={country}
                  onChange={setCountry}
                  placeholder="ค้นหาหรือเลือกประเทศ..."
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
            <div className="flex justify-end pt-2">
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

                <StudioSection title="ข้อมูลเพิ่มเติม" subtitle="แนวทางจัดการโปรไฟล์นักแปลให้พร้อมใช้งาน">
                  <div className="space-y-4 text-sm text-white/60">
                    <p>กรอก bio ให้ชัดเจนเพื่อช่วยให้ผู้อ่านรู้จักแนวทางการแปลของคุณมากขึ้น</p>
                    <p>เลือกภาษาที่แปลได้ให้ครบ เพราะข้อมูลนี้สามารถนำไปใช้กับระบบค้นหานักแปลหรือ matching ในอนาคตได้</p>
                    <p>ตั้งค่าภาษาหลักเพื่อใช้เป็นค่าเริ่มต้นในเครื่องมือ Studio และให้ทีมงานตีความโปรไฟล์ได้ตรงขึ้น</p>
                    <p>ถ้าอยากให้หน้าโปรไฟล์พร้อมใช้งานจริง ควรมีรูปโปรไฟล์ ประเทศ และอย่างน้อย 1 ภาษาแปล</p>
                  </div>
                </StudioSection>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
