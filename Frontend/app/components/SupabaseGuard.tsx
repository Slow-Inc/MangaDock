"use client";

import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import { getHardwareId } from "../lib/fingerprint";

/**
 * Monitors global fetch calls or specific backend error states to show a persistent
 * popup when the database (Supabase) is offline.
 * Also injects Hardware ID for Zero-Trust readiness.
 */
export default function SupabaseGuard() {
  const { toast } = useToast();

  useEffect(() => {
    // Intercept global fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      // T4-STANDARD Pillar 5: Zero-Trust Asset Protection (Stub)
      // Automatically add Hardware ID to headers if it's an API request
      const url = args[0]?.toString() || '';
      const isApiRequest = url.startsWith('/') || url.includes('localhost') || url.includes('supabase.co');
      
      if (isApiRequest) {
        const hwId = getHardwareId();
        let options = (args[1] as RequestInit) || {};
        const headers = new Headers(options.headers || {});
        if (!headers.has('x-hardware-id')) {
          headers.set('x-hardware-id', hwId);
        }
        options.headers = headers;
        args[1] = options;
      }

      try {
        const response = await originalFetch(...args);
        
        // Clone response to read body without consuming it for the original caller
        const clonedResponse = response.clone();
        if (clonedResponse.status === 503 || clonedResponse.status === 500) {
          try {
            const data = await clonedResponse.json();
            if (data.code === 'SUPABASE_OFFLINE') {
              toast.error(
                "⚠️ ตรวจพบปัญหาการเชื่อมต่อฐานข้อมูล: โครงการ Supabase ของคุณอาจถูกหยุดชั่วคราว (Paused) กรุณาเปิดใช้งานที่ Supabase Dashboard",
                { duration: 10000 }
              );
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
             toast.error(
                "❌ ไม่สามารถติดต่อฐานข้อมูล Supabase ได้โดยตรง: กรุณาตรวจสอบว่าโครงการไม่ได้ถูก Pause ไว้",
                { duration: 10000 }
              );
          }
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [toast]);

  return null; // This component doesn't render anything itself
}
