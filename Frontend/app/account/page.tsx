"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import AccountModal from "../components/AccountModal";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? undefined;
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (!user) return null;

  return (
    <main className="bg-[#141414]">
      <AccountModal isOpen asPage onClose={() => router.back()} initialTab={tab} />
    </main>
  );
}
