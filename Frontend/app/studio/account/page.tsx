"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import LoadingScreen from "../../components/LoadingScreen";
import { useProtectedPage } from "../../hooks/useProtectedPage";
import { useToast } from "../../contexts/ToastContext";
import { getMyProfile, updateTranslatorProfile } from "../../lib/studioApi";
import { getCached, setCache } from "../../lib/studioCache";
import { StudioAccountSkeleton } from "../components/StudioSkeleton";
import { MetricCard, StudioSection } from "../components/StudioDashboardWidgets";
import { StudioToolbar } from "../components/StudioToolbar";
import { StudioSelect } from "../components/StudioSelect";
import { CountrySelect } from "../components/CountrySelect";
import { getAccountProfileCompleteness } from "../lib/dashboardAnalytics";
import Loader from "../../components/ui/Loader";
import { PRIMARY_FILL } from "../../components/ui/Button";
import { User } from "lucide-react";

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
      label="ภาษาหลัก"
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

  if (loading) return <LoadingScreen />;

  return (
    <div className="text-ink">
      <StudioToolbar>
        <p className="text-sm text-ink-3">จัดการโปรไฟล์ ภาษา และข้อมูลหลักของบัญชี</p>
        <p className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-2">
          ความสมบูรณ์ของโปรไฟล์ <span className="font-semibold tabular-nums text-ok">{profileCompleteness.percent}%</span>
        </p>
      </StudioToolbar>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="space-y-5">
          {loadingProfile ? (
            <StudioAccountSkeleton />
          ) : (
            <div className="space-y-6">
              <StudioSection title="สถานะบัญชี" subtitle="ข้อมูลโปรไฟล์และสถานะการยืนยันของบัญชีนักแปล">
                <div className="space-y-4">
                  <div className={`rounded-2xl border px-4 py-4 ${profileCompleteness.percent >= 80 ? "border-ok/20 bg-ok/10" : "border-accent/20 bg-accent/10"}`}>
                    <p className={`text-sm font-medium ${profileCompleteness.percent >= 80 ? "text-ok" : "text-accent"}`}>
                      {profileCompleteness.percent >= 80
                        ? "โปรไฟล์นักแปลของคุณพร้อมใช้งาน"
                        : "โปรไฟล์ยังกรอกไม่ครบ แนะนำให้เติมข้อมูลให้สมบูรณ์"}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">
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
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-fill p-5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised">
                {user?.photoURL ? (
                  <Image src={user.photoURL} alt="" fill className="object-cover" />
                ) : (
                  <User aria-hidden className="h-6 w-6 text-ink-3" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{user?.displayName ?? "ไม่ระบุชื่อ"}</p>
                <p className="truncate text-sm text-ink-3">{user?.email ?? ""}</p>
                <span className="mt-1 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                  นักแปล
                </span>
              </div>
            </div>

            {/* Bio */}
            <div className="rounded-2xl border border-line bg-fill p-5">
              <label htmlFor="studio-bio" className="mb-2 block text-sm font-semibold">แนะนำตัว</label>
              <textarea
                id="studio-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="เล่าเกี่ยวกับตัวคุณให้ผู้อ่านรู้จัก..."
                rows={3}
                className="w-full resize-none rounded-xl border border-line bg-fill px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
              />
              <p className="mt-1 text-right text-[10px] text-ink-3">{bio.length}/500</p>
            </div>

            {/* Languages */}
            <div className="rounded-2xl border border-line bg-fill p-5">
              <p id="studio-langs-label" className="mb-1 block text-sm font-semibold">ภาษาที่แปลได้</p>
              <p id="studio-langs-hint" className="mb-3 text-xs text-ink-3">เลือกภาษาที่คุณสามารถแปลได้ (สูงสุด 10 ภาษา)</p>
              {/* a group of toggles, not one field: named by its heading, each toggle states whether it is on (#1041) */}
              <div role="group" aria-labelledby="studio-langs-label" aria-describedby="studio-langs-hint" className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const selected = languages.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        selected
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-line bg-fill text-ink-2 hover:border-ink-3 hover:text-ink-2"
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
              <div className="rounded-2xl border border-line bg-fill p-5">
                <label htmlFor="studio-country" className="mb-2 block text-sm font-semibold">ประเทศ</label>
                <CountrySelect
                  id="studio-country"
                  value={country}
                  onChange={setCountry}
                  placeholder="ค้นหาหรือเลือกประเทศ..."
                />
              </div>
              <div className="rounded-2xl border border-line bg-fill p-5">
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
                className={`rounded-xl ${PRIMARY_FILL} px-6 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-40`}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader context="inline" />
                    กำลังบันทึก...
                  </span>
                ) : (
                  "บันทึกการเปลี่ยนแปลง"
                )}
              </button>
            </div>
                </div>

                <StudioSection title="ข้อมูลเพิ่มเติม" subtitle="แนวทางจัดการโปรไฟล์นักแปลให้พร้อมใช้งาน">
                  <div className="space-y-4 text-sm text-ink-2">
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
