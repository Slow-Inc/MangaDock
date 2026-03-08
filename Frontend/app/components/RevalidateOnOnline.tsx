"use client";

import { useEffect } from "react";
import { useSystemStatus } from "../hooks/useSystemStatus";

export default function RevalidateOnOnline() {
  const mangadexStatus = useSystemStatus('mangadex');

  useEffect(() => {
    if (mangadexStatus === 'online') {
      window.location.reload();
    }
  }, [mangadexStatus]);

  return null;
}
