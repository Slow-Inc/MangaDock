"use client";
import { useReducer } from "react";
import { useRouter } from "next/navigation";
import DangerTab from "../../components/account/DangerTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function DangerSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const router = useRouter();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-red-300">โซนอันตราย</h2>
        <p className="mt-1 text-xs text-white/40">ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร</p>
      </div>
      <DangerTab formState={formState} dispatch={dispatch} onClose={() => router.push("/")} />
    </div>
  );
}
