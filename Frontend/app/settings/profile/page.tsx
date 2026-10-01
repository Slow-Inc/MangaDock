"use client";
import { useReducer } from "react";
import ProfileTab from "../../components/account/ProfileTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function ProfileSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">ข้อมูลส่วนตัว</h2>
        <p className="mt-1 text-xs text-white/40">แก้ไขชื่อผู้ใช้และรูปโปรไฟล์</p>
      </div>
      <ProfileTab formState={formState} dispatch={dispatch} isOpen={true} />
    </div>
  );
}
