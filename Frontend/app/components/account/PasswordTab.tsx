"use client";

import { useState } from "react";
import { errMessage } from "@/lib/errMessage";
import { useAuth } from "../../contexts/AuthContext";
import type { FormState, FormAction } from "./formReducer";

interface PasswordTabProps {
  formState: FormState;
  dispatch: React.Dispatch<FormAction>;
}

const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30";
const labelClass = "block text-xs font-medium text-white/50 mb-1.5";

export default function PasswordTab({ formState, dispatch }: PasswordTabProps) {
  const { user, updateUserPassword, addEmailPassword } = useAuth();
  const { loading, successMessage, errorMessage } = formState;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const hasPasswordProvider = user?.providerData.some(p => p.providerId === "password");

  const handleUpdatePassword = async () => {
    dispatch({ type: "CLEAR" });
    if (newPassword !== confirmPassword) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านใหม่ไม่ตรงกัน" });
      return;
    }
    if (newPassword.length < 6) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await updateUserPassword(currentPassword, newPassword);
      dispatch({ type: "SET_SUCCESS", message: "เปลี่ยนรหัสผ่านสำเร็จ ✓" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        dispatch({ type: "SET_ERROR", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  const handleAddEmailPassword = async () => {
    dispatch({ type: "CLEAR" });
    if (newPassword !== confirmPassword) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านไม่ตรงกัน" });
      return;
    }
    if (newPassword.length < 6) {
      dispatch({ type: "SET_ERROR", message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }
    dispatch({ type: "SET_LOADING", value: true });
    try {
      await addEmailPassword(newPassword);
      dispatch({ type: "SET_SUCCESS", message: "เพิ่มรหัสผ่านสำเร็จ ✓ ตอนนี้คุณสามารถ login ด้วย Email ได้แล้ว" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/provider-already-linked") {
        dispatch({ type: "SET_ERROR", message: "เชื่อมต่อ Email/Password อยู่แล้ว" });
      } else {
        dispatch({ type: "SET_ERROR", message: errMessage(error) || "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      }
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
      {hasPasswordProvider ? (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>รหัสผ่านปัจจุบัน</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>รหัสผ่านใหม่</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="•••••••• (อย่างน้อย 6 ตัว)" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ยืนยันรหัสผ่านใหม่</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>
          <button
            onClick={handleUpdatePassword}
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
            <p className="text-xs text-blue-300">ℹ️ เพิ่มรหัสผ่านเพื่อให้สามารถ login ด้วย Email <strong>{user?.email}</strong> ได้โดยไม่ต้องใช้ Google</p>
          </div>
          <div>
            <label className={labelClass}>รหัสผ่านใหม่</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="•••••••• (อย่างน้อย 6 ตัว)" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ยืนยันรหัสผ่าน</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>
          <button
            onClick={handleAddEmailPassword}
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังเพิ่มรหัสผ่าน..." : "เพิ่มรหัสผ่าน"}
          </button>
        </div>
      )}
    </>
  );
}
