"use client";
import { useReducer, useCallback } from "react";
import { useRouter } from "next/navigation";
import AccountsTab from "../../components/account/AccountsTab";
import { formReducer, initialFormState } from "../../components/account/formReducer";

export default function AccountsSettingsPage() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const router = useRouter();
  const handleTabChange = useCallback((tab: string) => router.push(`/settings/${tab}`), [router]);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">การเชื่อมต่อ</h2>
        <p className="mt-1 text-xs text-white/40">เชื่อมต่อ Google และ Facebook</p>
      </div>
      <AccountsTab formState={formState} dispatch={dispatch} onTabChange={handleTabChange} onClose={() => router.push("/")} />
    </div>
  );
}
