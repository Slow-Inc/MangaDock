"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

const API_BASE = "/api/proxy";

type PublicTranslatorProfile = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  translatorLanguages: string[];
  trustScore: number;
  ratingAvg: number;
  ratingCount: number;
  country: string | null;
};

type ChapterVersion = {
  versionId: string;
  titleName: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  status: string;
  priceCoins: number;
  qualityScore: number;
  createdAt: unknown;
};

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-yellow-400">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function LanguagePill({ lang }: { lang: string }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
      {lang.toUpperCase()}
    </span>
  );
}

export default function TranslatorProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicTranslatorProfile | null>(null);
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE}/users/${uid}/translator`),
      fetch(`${API_BASE}/versions/translator/${uid}`),
    ])
      .then(async ([profileRes, versionsRes]) => {
        if (!profileRes.ok) {
          setNotFound(true);
          return;
        }
        const profileData = await profileRes.json();
        setProfile(profileData);
        if (versionsRes.ok) {
          const versionsData = await versionsRes.json();
          setVersions(versionsData);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#141414] text-white">
        <p className="text-lg font-semibold">ไม่พบโปรไฟล์นักแปล</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const publishedVersions = versions.filter((v) => v.status === "published");

  return (
    <div className="min-h-dvh bg-[#141414] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#1a1a1a]">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/10">
              {profile.photoURL ? (
                <Image
                  src={profile.photoURL}
                  alt={profile.displayName ?? "Translator"}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/30">
                  {(profile.displayName ?? "T")[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{profile.displayName ?? "นักแปล"}</h1>
                <span className="rounded-full bg-indigo-600/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                  นักแปล
                </span>
              </div>
              {profile.country && (
                <p className="mt-0.5 text-sm text-white/40">{profile.country}</p>
              )}
              {profile.bio && (
                <p className="mt-2 text-sm leading-relaxed text-white/60">{profile.bio}</p>
              )}
              {/* Languages */}
              {profile.translatorLanguages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.translatorLanguages.map((lang) => (
                    <LanguagePill key={lang} lang={lang} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 flex flex-wrap gap-6">
            <div className="text-center">
              <p className="text-xl font-bold">{publishedVersions.length}</p>
              <p className="text-xs text-white/40">งานแปลที่เผยแพร่</p>
            </div>
            {profile.ratingCount > 0 && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <StarIcon />
                  <p className="text-xl font-bold">{profile.ratingAvg.toFixed(1)}</p>
                </div>
                <p className="text-xs text-white/40">({profile.ratingCount} รีวิว)</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-xl font-bold">{profile.trustScore}</p>
              <p className="text-xs text-white/40">Trust Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Translations list */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h2 className="mb-4 text-base font-semibold text-white/80">
          งานแปลล่าสุด
        </h2>
        {publishedVersions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/3 px-6 py-10 text-center">
            <p className="text-sm text-white/40">ยังไม่มีงานแปลที่เผยแพร่</p>
          </div>
        ) : (
          <div className="space-y-3">
            {publishedVersions.map((v) => (
              <div
                key={v.versionId}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/3 px-4 py-3 transition hover:bg-white/6"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{v.titleName}</p>
                  <p className="text-xs text-white/40">
                    ตอนที่ {v.chapterNumber}
                    {v.chapterTitle ? ` — ${v.chapterTitle}` : ""}
                    <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">
                      {v.language.toUpperCase()}
                    </span>
                  </p>
                </div>
                {v.priceCoins > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-yellow-400">
                    {v.priceCoins} เหรียญ
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
