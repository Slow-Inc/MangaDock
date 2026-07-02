"use client";

// One hook for the live MIT telemetry every Dashboard surface needs (#304 / I1 #305) —
// folds the repeated `useDevAuth` → `useLiveSnapshot` → `live.mit` → `liveMit` flag →
// `series`/`seriesT`/`events` boilerplate into one place. The overview, the /service/mit
// page, and the live console all consume this instead of re-deriving it. Pass
// `connect=false` on non-MIT pages so they open no SSE connection.

import { useDevAuth } from "@/components/auth-gate";
import { useLiveSnapshot } from "@/components/use-live-snapshot";
import type { MitLive } from "@/lib/live-map";
import type { SeriesMap } from "@/lib/live-series";

export interface MitLiveState {
  mit: MitLive | null;
  liveMit: boolean; // connected AND a snapshot is present — the gate for live-vs-mock/No-Data
  status: "connecting" | "live" | "offline";
  series: SeriesMap;
  seriesT: number[];
  events: unknown[];
}

export function useMitLive(connect: boolean = true): MitLiveState {
  const { token } = useDevAuth();
  const live = useLiveSnapshot(connect ? token : null);
  const mit = live.mit;
  return {
    mit,
    liveMit: live.status === "live" && !!mit,
    status: live.status,
    series: live.series,
    seriesT: live.seriesT,
    events: live.events,
  };
}
