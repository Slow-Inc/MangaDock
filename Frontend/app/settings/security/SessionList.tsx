"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { getHardwareId } from "../../lib/fingerprint";

interface Device {
  id: string;
  hwid: string;
  user_agent: string | null;
  first_seen: string;
  last_seen: string;
}

function parseUA(ua: string | null): string {
  if (!ua) return "อุปกรณ์ไม่ระบุ";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iPhone/iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  return "อุปกรณ์อื่น";
}

export default function SessionList() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  // the hwid this browser reports (AuthContext records it on sign-in), so its row can say "this device"
  const [currentHwid, setCurrentHwid] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_known_devices")
      .select("id, hwid, user_agent, first_seen, last_seen")
      .eq("uid", user.id)
      .order("last_seen", { ascending: false })
      .then(({ data }) => {
        setDevices((data as Device[]) ?? []);
        setCurrentHwid(getHardwareId());
        setLoading(false);
      });
  }, [user]);

  // The list is a device history (by hwid); this revokes every other Supabase session, so the rows stay (#674).
  const handleSignOutOthers = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      showToast({ type: "success", message: "ออกจากระบบในอุปกรณ์อื่นแล้ว อุปกรณ์นี้ยังเข้าสู่ระบบอยู่" });
    } catch {
      showToast({ type: "error", message: "ออกจากระบบในอุปกรณ์อื่นไม่สำเร็จ ลองอีกครั้ง" });
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) return <div className="h-20 animate-pulse rounded-xl bg-fill" />;

  return (
    <div className="space-y-2">
      {devices.length === 0 && (
        <p className="text-xs text-ink-3">ไม่พบข้อมูลอุปกรณ์</p>
      )}
      {devices.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between rounded-xl border border-line bg-fill px-4 py-3"
        >
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              {parseUA(d.user_agent)}
              {currentHwid !== "" && d.hwid === currentHwid && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">อุปกรณ์นี้</span>
              )}
            </p>
            <p className="text-xs text-ink-3">
              ล่าสุด:{" "}
              {new Date(d.last_seen).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      ))}
      <p className="text-xs text-ink-3">
        รายการนี้เป็นประวัติอุปกรณ์ที่เคยเข้าสู่ระบบ ออกจากระบบแล้วรายการก็ยังอยู่
      </p>
      <button
        onClick={handleSignOutOthers}
        disabled={signingOut}
        className="mt-1 w-full rounded-xl border border-danger/20 bg-danger/10 py-2 text-xs font-medium text-danger transition hover:bg-danger/15 disabled:opacity-50"
      >
        {signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบในอุปกรณ์อื่นทั้งหมด"}
      </button>
    </div>
  );
}
