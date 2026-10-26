"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Button from "../components/ui/Button";
import LoadError from "../components/ui/LoadError";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/pageTitle";
import {
  retentionApi,
  type ReadingCollection,
  type CollectionInput,
} from "../lib/retentionApi";
import CollectionForm from "./CollectionForm";

function Collections({ uid }: { uid: string }) {
  const [items, setItems] = useState<ReadingCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setLoading(true);
    setFailed(false);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let alive = true;
    retentionApi
      .collections(uid)
      .then((data) => {
        if (alive) setItems(data);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [uid, revision]);
  const save = async (input: CollectionInput) => {
    setBusy(true);
    setError("");
    try {
      await retentionApi.save(uid, input);
      setCreating(false);
      reload();
    } catch {
      setError(
        "สร้างคอลเลกชันไม่สำเร็จ กรุณาลองอีกครั้ง (สูงสุด 100 คอลเลกชัน)",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-ink-2">
          จัดเรื่องที่อยากอ่านเป็นชุด แล้วแบ่งปันให้เพื่อน
        </p>
        <Button
          variant="primary"
          onClick={() => setCreating((value) => !value)}
          disabled={busy}
        >
          {creating ? "ปิดแบบฟอร์ม" : "คอลเลกชันใหม่"}
        </Button>
      </div>
      {creating && (
        <section className="mb-8 rounded-xl border border-line p-5">
          <h2 className="mb-4 text-xl font-semibold">คอลเลกชันใหม่</h2>
          <CollectionForm busy={busy} onSave={save} />
          {error && (
            <p role="alert" className="mt-3 text-danger">
              {error}
            </p>
          )}
        </section>
      )}
      {loading ? (
        <p role="status" className="py-12 text-ink-2">
          กำลังโหลดคอลเลกชัน…
        </p>
      ) : failed ? (
        <LoadError what="คอลเลกชัน" onRetry={reload} />
      ) : items.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/collections/${item.id}`}
                className="block py-5 hover:bg-fill"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="break-words text-lg font-semibold">
                    {item.name}
                  </h2>
                  <span className="text-sm text-ink-2">
                    {item.visibility === "public" ? "สาธารณะ" : "ส่วนตัว"}
                  </span>
                </div>
                <p className="mt-2 break-words text-sm text-ink-2">
                  {item.description || "เพิ่มมังงะที่คุณอยากเก็บไว้ด้วยกัน"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16 text-center">
          <h2 className="text-xl font-semibold">เก็บเรื่องโปรดไว้ด้วยกัน</h2>
          <p className="mt-3 text-ink-2">
            สร้างคอลเลกชันแรก เช่น “อ่านวันหยุด” หรือ “อยากแนะนำให้เพื่อน”
          </p>
        </div>
      )}
    </>
  );
}

export default function CollectionsPage() {
  const { user, loading, showLoginPrompt } = useAuth();
  usePageTitle("คอลเลกชันของฉัน");
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-28 pt-28 sm:px-6">
        <Link
          href="/mylist"
          className="text-sm text-accent underline underline-offset-4"
        >
          รายการของฉัน
        </Link>
        <h1 className="mb-6 mt-4 text-3xl font-semibold">คอลเลกชันของฉัน</h1>
        {loading ? (
          <p role="status">กำลังตรวจสอบบัญชี…</p>
        ) : user ? (
          <Collections key={user.uid} uid={user.uid} />
        ) : (
          <div className="py-12">
            <p className="mb-4 text-ink-2">
              เข้าสู่ระบบเพื่อสร้างและจัดการคอลเลกชันของคุณ
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
