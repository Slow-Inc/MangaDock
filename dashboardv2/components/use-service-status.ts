"use client";

import { useEffect, useState } from "react";
import { isMockMode } from "@/lib/mock-mode";
import { MOCK_SERVICE_STATUS } from "@/lib/mock-live";
import type { ServiceStatusMap } from "@/lib/service-status";

const INITIAL: ServiceStatusMap = { frontend: null, backend: null };

export function useServiceStatus(): ServiceStatusMap {
  const mock = isMockMode();
  const [status, setStatus] = useState<ServiceStatusMap>(mock ? MOCK_SERVICE_STATUS : INITIAL);

  useEffect(() => {
    if (mock) return;
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/service-status", {
          signal: AbortSignal.timeout(2000),
        });
        if (active && res.ok) setStatus(await res.json());
      } catch {
        // network error — keep stale value until next tick
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [mock]);

  return status;
}
