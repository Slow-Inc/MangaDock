"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface Device {
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

export default function ActivityLog() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_known_devices")
      .select("hwid, user_agent, first_seen, last_seen")
      .eq("uid", user.id)
      .order("last_seen", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setDevices((data as Device[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-white/5" />;

  return (
    <div className="space-y-1.5">
      {devices.map((d, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
        >
          <div className="h-2 w-2 shrink-0 rounded-full bg-green-400/60" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/70">
              {parseUA(d.user_agent)} · เข้าสู่ระบบ
            </p>
            <p className="text-[11px] text-white/35">
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
      {devices.length === 0 && (
        <p className="text-xs text-white/30">ยังไม่มีประวัติการเข้าสู่ระบบ</p>
      )}
    </div>
  );
}
