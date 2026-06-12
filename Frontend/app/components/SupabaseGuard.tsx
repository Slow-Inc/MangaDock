"use client";

import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import { getHardwareId } from "../lib/fingerprint";
import { isApiRequest, withZeroTrustHeaders } from "../lib/zeroTrustHeaders";

/**
 * Monitors global fetch calls or specific backend error states to show a persistent
 * popup when the database (Supabase) is offline.
 * Also injects Hardware ID for Zero-Trust readiness.
 */
export default function SupabaseGuard() {
  const { showToast } = useToast();

  useEffect(() => {
    // Intercept global fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      // T4-STANDARD Pillar 5: Zero-Trust Asset Protection
      // Attach the device Hardware ID and (when present) the HWID-bound captcha
      // clearance token (#227) so every captcha-guarded endpoint reuses the same
      // token the reader already obtained from /books/verify-captcha.
      const url = args[0]?.toString() || '';
      if (isApiRequest(url)) {
        const clearance = localStorage.getItem('cf_clearance_token');
        args[1] = withZeroTrustHeaders(args[1] as RequestInit, getHardwareId(), clearance);
      }

      try {
        const response = await originalFetch(...args);
        
        // Clone response to read body without consuming it for the original caller
        const clonedResponse = response.clone();
        if (clonedResponse.status === 503 || clonedResponse.status === 500) {
          try {
            const data = await clonedResponse.json();
            if (data.code === 'SUPABASE_OFFLINE') {
              showToast({
                message: "⚠️ ตรวจพบปัญหาการเชื่อมต่อฐานข้อมูล: โครงการ Supabase ของคุณอาจถูกหยุดชั่วคราว (Paused) กรุณาเปิดใช้งานที่ Supabase Dashboard",
                type: "error",
                duration: 10000
              });
            }
          } catch {
            // Not JSON or other error, ignore
          }
        }
        
        return response;
      } catch (error) {
        // Handle network errors (when backend is down or Supabase DNS fails on client side)
        const msg = String(error);
        if (msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
          // Check if it's a Supabase-related URL
          const url = args[0]?.toString() || '';
          if (url.includes('supabase.co')) {
             showToast({
                message: "❌ ไม่สามารถติดต่อฐานข้อมูล Supabase ได้โดยตรง: กรุณาตรวจสอบว่าโครงการไม่ได้ถูก Pause ไว้",
                type: "error",
                duration: 10000
              });
          }
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [showToast]);

  return null; // This component doesn't render anything itself
}
