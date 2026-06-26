"use client";

import { useState, useCallback } from "react";
import { createTopup } from "../lib/studioApi";
import { errMessage } from "@/lib/errMessage";
import type { TopupResult } from "../lib/studioApi";

export const TIERS = [20, 50, 100, 200, 500, 1000] as const;

export function computeEffectiveAmount(
  selected: number,
  custom: string,
  useCustom: boolean,
): number {
  return useCustom ? (parseInt(custom, 10) || 0) : selected;
}

export function useTopupCreate(getIdToken: () => Promise<string | null>) {
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const effectiveAmount = computeEffectiveAmount(selectedAmount, customAmount, useCustom);
  const canProceed = effectiveAmount >= 20;

  const handleProceed = useCallback(async (): Promise<TopupResult | null> => {
    if (!canProceed) return null;
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("ไม่ได้เข้าสู่ระบบ");
      return await createTopup(token, effectiveAmount);
    } catch (err) {
      setError(errMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [canProceed, effectiveAmount, getIdToken]);

  return {
    selectedAmount, setSelectedAmount,
    customAmount, setCustomAmount,
    useCustom, setUseCustom,
    effectiveAmount, canProceed,
    loading, error,
    handleProceed,
  };
}
