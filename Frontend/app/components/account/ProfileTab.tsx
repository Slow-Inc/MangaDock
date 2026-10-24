"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { errMessage } from "@/lib/errMessage";
import type { FormState, FormAction } from "./formReducer";
import { PRIMARY_FILL } from "../ui/Button";

interface ProfileTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
  isOpen: boolean;
}

const inputClass = "w-full rounded-xl border border-line bg-fill px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 transition focus:border-accent/40";
const labelClass = "block text-xs font-medium text-ink-2 mb-1.5";

export default function ProfileTab({ formState, dispatch, isOpen }: ProfileTabProps) {
  const { user, updateUserProfile, isTranslator } = useAuth();
  const { loading, successMessage, errorMessage } = formState;

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email] = useState(user?.email ?? "");

  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.displayName ?? "");
    }
  }, [user, isOpen]);

  const handleUpdateProfile = async () => {
    dispatch({ type: "CLEAR" });
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await updateUserProfile(displayName);
      dispatch({ type: "SET_SUCCESS", message: "อัปเดตชื่อผู้ใช้สำเร็จ ✓" });
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  return (
    <>
      {/* Always-mounted live regions, filled when there is a message — announced on Save (#907). One wrapper, so the
          page's space-y stack gains one (empty, 0 px) child, not two. */}
      <div>
        <div role="status">
          {successMessage && (
            <div className="mb-4 rounded-xl bg-ok/10 border border-ok/40 px-4 py-2.5 text-sm text-ok">
              {successMessage}
            </div>
          )}
        </div>
        <div role="alert">
          {errorMessage && (
            <div className="mb-4 rounded-xl bg-danger/10 border border-danger/40 px-4 py-2.5 text-sm text-danger">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor="profile-name" className={labelClass}>ชื่อผู้ใช้</label>
          <input
            id="profile-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            placeholder="ชื่อของคุณ"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="profile-email" className={labelClass}>อีเมล</label>
          <input
            id="profile-email"
            type="email"
            value={email}
            disabled
            title="อีเมล (ไม่สามารถแก้ไขได้)"
            className="w-full rounded-xl border border-line bg-fill px-4 py-2.5 text-sm text-ink-3 outline-none cursor-not-allowed"
          />
          <p className="text-[11px] text-ink-3 mt-1.5">ไม่สามารถเปลี่ยนอีเมลได้ในขณะนี้</p>
        </div>
        <button
          onClick={handleUpdateProfile}
          disabled={loading || !displayName.trim()}
          className={`w-full rounded-xl ${PRIMARY_FILL} py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>

        <div className="rounded-xl border border-line bg-fill px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-ink-2">สตูดิโอนักแปล</p>
              <p className="text-[11px] text-ink-3">
                {isTranslator ? "จัดการงานแปลและอัปโหลดใหม่" : "สมัครเพื่อเริ่มอัปโหลดงานแปล"}
              </p>
            </div>
            <Link
              href="/studio"
              className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
            >
              {isTranslator ? "เปิดสตูดิโอ" : "สมัคร"}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
