"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import AccountModal from "../components/AccountModal";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? undefined;
  const { user, loading } = useAuth();

  const handleClose = useCallback(() => router.back(), [router]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (!user) return null;

  return (
    <main className="bg-[#141414]">
      <AccountModal isOpen asPage onClose={handleClose} initialTab={tab} />
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  );
}
