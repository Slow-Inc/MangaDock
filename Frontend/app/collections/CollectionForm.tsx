"use client";
import { useId, useState, type FormEvent } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import type { CollectionInput } from "../lib/retentionApi";

export default function CollectionForm({
  initial,
  busy,
  onSave,
}: {
  initial?: CollectionInput;
  busy: boolean;
  onSave: (input: CollectionInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(
    initial?.visibility ?? "private",
  );
  const visibilityId = useId();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    await onSave({ name: name.trim(), description, visibility });
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        ชื่อคอลเลกชัน
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          className="mt-2"
        />
      </label>
      <label className="block text-sm font-medium">
        คำอธิบาย
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-2 block w-full rounded-xl border border-line bg-surface p-4 text-ink"
        />
      </label>
      <div>
        <label htmlFor={visibilityId} className="block text-sm font-medium">
          การมองเห็น
        </label>
        <select
          id={visibilityId}
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as "public" | "private")
          }
          className="mt-2 block min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink"
        >
          <option value="private">ส่วนตัว — เฉพาะคุณ</option>
          <option value="public">สาธารณะ — ทุกคนที่มีลิงก์ดูได้</option>
        </select>
      </div>
      <p className="text-sm text-ink-2">
        {visibility === "private"
          ? "คอลเลกชันส่วนตัวเปิดจากลิงก์ได้เฉพาะเจ้าของ"
          : "ชื่อ คำอธิบาย และรายชื่อมังงะจะเปิดอ่านได้โดยไม่ต้องเข้าสู่ระบบ"}
      </p>
      <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
        {busy ? "กำลังบันทึก…" : initial ? "บันทึกการแก้ไข" : "สร้างคอลเลกชัน"}
      </Button>
    </form>
  );
}
