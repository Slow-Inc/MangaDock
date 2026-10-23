"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import Button from "../../components/ui/Button";
import LoadError from "../../components/ui/LoadError";
import MangaSearchSelector from "../../components/MangaSearchSelector";
import { useAuth } from "../../contexts/AuthContext";
import { usePageTitle } from "../../hooks/pageTitle";
import {
  retentionApi,
  type CollectionDetail,
  type CollectionInput,
} from "../../lib/retentionApi";
import type { LandingBook } from "../../lib/types";
import { HttpError } from "../../lib/httpError";
import CollectionForm from "../CollectionForm";

function Detail({ id, uid }: { id: string; uid: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<LandingBook | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = () => {
    setLoading(true);
    setFailed(false);
    setMissing(false);
    setRevision((value) => value + 1);
  };
  const owner = !!uid && data?.owner_uid === uid;
  usePageTitle(data?.name ?? "คอลเลกชัน");
  useEffect(() => {
    let alive = true;
    retentionApi
      .collection(id, uid)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((reason) => {
        if (alive) {
          setData(null);
          setMissing(
            reason instanceof HttpError && [400, 404].includes(reason.status),
          );
          setFailed(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, uid, revision]);
  const mutate = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      reload();
    } catch {
      setError(
        "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง (สูงสุด 200 เรื่องต่อคอลเลกชัน)",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async (input: CollectionInput) => {
    await mutate(async () => {
      await retentionApi.save(uid!, input, id);
      setEditing(false);
    });
  };
  if (loading)
    return (
      <p role="status" className="py-12 text-ink-2">
        กำลังโหลดคอลเลกชัน…
      </p>
    );
  if (missing)
    return (
      <div className="py-12">
        <h1 className="text-2xl font-semibold">
          ไม่พบคอลเลกชัน หรือเป็นคอลเลกชันส่วนตัว
        </h1>
        <p className="mt-3 text-ink-2">
          ตรวจสอบลิงก์ หรือเข้าสู่ระบบด้วยบัญชีเจ้าของคอลเลกชัน
        </p>
      </div>
    );
  if (failed || !data) return <LoadError what="คอลเลกชัน" onRetry={reload} />;
  return (
    <>
      <div className="my-6">
        <p className="text-sm text-ink-2">
          {data.visibility === "public"
            ? "คอลเลกชันสาธารณะ"
            : "คอลเลกชันส่วนตัว"}{" "}
          · {data.items.length} เรื่อง
        </p>
        <h1 className="mt-2 break-words text-3xl font-semibold">{data.name}</h1>
        <p className="mt-3 whitespace-pre-wrap break-words text-ink-2">
          {data.description}
        </p>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {data.visibility === "public" && (
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${location.origin}/collections/${id}`,
                );
                setNotice("คัดลอกลิงก์แล้ว");
              } catch {
                setError(
                  "คัดลอกไม่สำเร็จ คุณสามารถคัดลอก URL จากแถบที่อยู่ได้",
                );
              }
            }}
          >
            คัดลอกลิงก์แชร์
          </Button>
        )}
        {owner && (
          <>
            <Button
              disabled={busy}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? "ปิดการแก้ไข" : "แก้ไขคอลเลกชัน"}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setDeleting((value) => !value)}
            >
              ลบคอลเลกชัน
            </Button>
          </>
        )}
      </div>
      {notice && (
        <p role="status" className="mb-4 text-ink-2">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-danger">
          {error}
        </p>
      )}
      {deleting && owner && (
        <div className="mb-6 rounded-xl border border-line p-4">
          <p className="mb-3">ลบคอลเลกชันนี้และรายการทั้งหมดหรือไม่?</p>
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void mutate(async () => {
                  await retentionApi.remove(uid!, id);
                  router.replace("/collections");
                })
              }
            >
              ยืนยันการลบ
            </Button>
            <Button disabled={busy} onClick={() => setDeleting(false)}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
      {editing && owner && (
        <section className="mb-8 rounded-xl border border-line p-5">
          <CollectionForm initial={data} busy={busy} onSave={save} />
        </section>
      )}
      {owner && (
        <section className="mb-8 space-y-4 rounded-xl border border-line p-5">
          <h2 className="text-lg font-semibold">เพิ่มมังงะ</h2>
          <MangaSearchSelector
            selectedManga={selected}
            onSelect={setSelected}
            label="ค้นหามังงะ"
            placeholder="พิมพ์ชื่อมังงะเพื่อเพิ่มเข้าคอลเลกชัน..."
          />
          <Button
            disabled={busy || !selected || data.items.length >= 200}
            onClick={() =>
              selected &&
              void mutate(async () => {
                await retentionApi.item(uid!, id, selected.id, selected.title);
                setSelected(null);
              })
            }
          >
            เพิ่มเข้าคอลเลกชัน
          </Button>
        </section>
      )}
      {data.items.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {data.items.map((item) => (
            <li
              key={item.manga_id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <Link
                href={`/book/${encodeURIComponent(item.manga_id)}`}
                className="min-w-0 break-words font-medium hover:underline"
              >
                {item.title}
              </Link>
              {owner && (
                <Button
                  size="sm"
                  disabled={busy}
                  aria-label={`นำ ${item.title} ออก`}
                  onClick={() =>
                    void mutate(() =>
                      retentionApi.item(
                        uid!,
                        id,
                        item.manga_id,
                        item.title,
                        true,
                      ),
                    )
                  }
                >
                  นำออก
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-12 text-center text-ink-2">
          {owner
            ? "ค้นหามังงะด้านบนเพื่อเพิ่มเรื่องแรก"
            : "เจ้าของยังไม่ได้เพิ่มมังงะในคอลเลกชันนี้"}
        </p>
      )}
    </>
  );
}

export default function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading, showLoginPrompt } = useAuth();
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-28 sm:px-6">
        <Link
          href="/collections"
          className="text-sm text-accent underline underline-offset-4"
        >
          คอลเลกชันของฉัน
        </Link>
        {loading ? (
          <p role="status" className="py-12">
            กำลังตรวจสอบบัญชี…
          </p>
        ) : (
          <Detail
            key={`${id}:${user?.uid ?? "guest"}`}
            id={id}
            uid={user?.uid ?? null}
          />
        )}
        {!loading && !user && (
          <Button className="mt-6" onClick={() => showLoginPrompt()}>
            เข้าสู่ระบบ
          </Button>
        )}
      </main>
    </>
  );
}
