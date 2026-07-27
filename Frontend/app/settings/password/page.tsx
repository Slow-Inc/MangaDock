"use client";
import { useReducer } from "react";
import PasswordTab from "../../components/account/PasswordTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function PasswordSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">รหัสผ่าน</h2>
        <p className="mt-1 text-xs text-white/40">เปลี่ยนรหัสผ่านบัญชีของคุณ</p>
      </div>
      <PasswordTab formState={formState} dispatch={dispatch} />
    </div>
  );
}
