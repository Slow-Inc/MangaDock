"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

/**
 * Auth-gated page helper: returns the full auth context and redirects to "/"
 * once auth has resolved (`!loading`) and there is no signed-in user.
 * Replaces the copy-pasted `useEffect(() => { if (!loading && !user) router.replace("/") })`
 * in studio account/wallet/works pages.
 */
export function useProtectedPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) router.replace("/");
  }, [auth.loading, auth.user, router]);

  return auth;
}
