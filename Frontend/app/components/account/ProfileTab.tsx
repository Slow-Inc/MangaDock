"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { errMessage } from "@/lib/errMessage";
import type { FormState, FormAction } from "./formReducer";

interface ProfileTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
  isOpen: boolean;
}

const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30";
const labelClass = "block text-xs font-medium text-white/50 mb-1.5";

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
      {successMessage && (
        <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm text-green-300">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className={labelClass}>ชื่อผู้ใช้</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ชื่อของคุณ"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>อีเมล</label>
          <input
            type="email"
            value={email}
            disabled
            title="อีเมล (ไม่สามารถแก้ไขได้)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 outline-none cursor-not-allowed"
          />
          <p className="text-[11px] text-white/30 mt-1.5">ไม่สามารถเปลี่ยนอีเมลได้ในขณะนี้</p>
        </div>
        <button
          onClick={handleUpdateProfile}
          disabled={loading || !displayName.trim()}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>

        <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70">สตูดิโอนักแปล</p>
              <p className="text-[11px] text-white/30">
                {isTranslator ? "จัดการงานแปลและอัปโหลดใหม่" : "สมัครเพื่อเริ่มอัปโหลดงานแปล"}
              </p>
            </div>
            <Link
              href="/studio"
              className="rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-600/30"
            >
              {isTranslator ? "เปิดสตูดิโอ" : "สมัคร"}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
