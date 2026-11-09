"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import PostCard from "../components/PostCard";
import { PostSkeleton } from "../components/ForumSkeleton";
import Button from "../components/ui/Button";
import LoadError from "../components/ui/LoadError";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/pageTitle";
import { retentionApi } from "../lib/retentionApi";
import type { ForumPost } from "../lib/types";

function FeedResults({
  uid,
  mode,
}: {
  uid: string;
  mode: "following" | "personalized";
}) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const lifetime = useRef({ alive: true });
  const [revision, setRevision] = useState(0);
  const load = useCallback(() => {
    setBusy(true);
    setFailed(false);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const current = lifetime.current;
    current.alive = true;
    let active = true;
    retentionApi
      .feed(uid, mode)
      .then((result) => {
        if (!active) return;
        setPosts(result.items);
        setTotal(result.total);
        setOffset(result.items.length);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      current.alive = false;
    };
  }, [uid, mode, revision]);
  const more = async () => {
    const current = lifetime.current;
    setBusy(true);
    setFailed(false);
    try {
      const result = await retentionApi.feed(uid, mode, offset);
      if (!current.alive) return;
      setPosts((previous) => {
        const seen = new Set(previous.map((post) => post.id));
        return [
          ...previous,
          ...result.items.filter((post) => !seen.has(post.id)),
        ];
      });
      setTotal(result.total);
      setOffset(offset + result.items.length);
    } catch {
      if (current.alive) setFailed(true);
    } finally {
      if (current.alive) setBusy(false);
    }
  };
  return (
    <>
      <p className="mb-6 text-sm text-ink-2">
        {mode === "following"
          ? "โพสต์ล่าสุดจากคนที่คุณติดตาม เรียงตามเวลา"
          : "โพสต์แนะนำจากเรื่องที่คุณอ่านหรือบันทึก คนที่ติดตาม ความใหม่ และการมีส่วนร่วม"}
      </p>
      <div className="space-y-4" aria-busy={busy}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {busy && !posts.length && (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        )}
        {failed && (
          <LoadError what="ฟีด" onRetry={posts.length ? more : load} />
        )}
        {!busy && !failed && !posts.length && (
          <div className="py-16 text-center">
            <h2 className="text-xl font-semibold">
              {mode === "following"
                ? "เริ่มจากคนที่คุณอยากอ่าน"
                : "ยังไม่มีโพสต์ให้แนะนำ"}
            </h2>
            <p className="my-3 text-ink-2">
              เปิดโปรไฟล์ในคอมมูนิตี้แล้วกดติดตาม โพสต์ใหม่ของพวกเขาจะอยู่ที่นี่
            </p>
            <Link
              href="/community"
              className="text-accent underline underline-offset-4"
            >
              สำรวจคอมมูนิตี้
            </Link>
          </div>
        )}
      </div>
      {!failed && offset < total && (
        <div className="mt-6 text-center">
          <Button disabled={busy} onClick={more}>
            {busy ? "กำลังโหลด…" : "โหลดเพิ่ม"}
          </Button>
        </div>
      )}
    </>
  );
}

function Feed({ uid }: { uid: string }) {
  const [mode, setMode] = useState<"following" | "personalized">("following");
  return (
    <>
      <div className="mb-4 flex gap-2" aria-label="เลือกฟีด">
        <Button
          aria-pressed={mode === "following"}
          variant={mode === "following" ? "primary" : "secondary"}
          onClick={() => setMode("following")}
        >
          กำลังติดตาม
        </Button>
        <Button
          aria-pressed={mode === "personalized"}
          variant={mode === "personalized" ? "primary" : "secondary"}
          onClick={() => setMode("personalized")}
        >
          สำหรับคุณ
        </Button>
      </div>
      <FeedResults key={mode} uid={uid} mode={mode} />
    </>
  );
}

export default function FeedPage() {
  const { user, loading, showLoginPrompt } = useAuth();
  usePageTitle("ฟีดของคุณ");
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-28 pt-28 sm:px-6">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">ฟีดของคุณ</h1>
            <p className="mt-2 text-ink-2">
              ติดตามบทสนทนาและค้นพบเรื่องที่อยากอ่านต่อ
            </p>
          </div>
          <Link
            href="/collections"
            className="py-2 text-accent underline underline-offset-4"
          >
            คอลเลกชันของฉัน
          </Link>
        </div>
        {loading ? (
          <PostSkeleton />
        ) : user ? (
          <Feed key={user.uid} uid={user.uid} />
        ) : (
          <div className="py-12">
            <p className="mb-4 text-ink-2">
              เข้าสู่ระบบเพื่อดูโพสต์จากคนที่คุณติดตามและฟีดสำหรับคุณ
            </p>
            <Button variant="primary" onClick={() => showLoginPrompt()}>
              เข้าสู่ระบบ
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
