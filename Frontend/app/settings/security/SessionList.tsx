"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_known_devices")
      .select("id, hwid, user_agent, first_seen, last_seen")
      .eq("uid", user.id)
      .order("last_seen", { ascending: false })
      .then(({ data }) => {
        setDevices((data as Device[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: "others" });
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) return <div className="h-20 animate-pulse rounded-xl bg-white/5" />;

  return (
    <div className="space-y-2">
      {devices.length === 0 && (
        <p className="text-xs text-white/30">ไม่พบข้อมูลอุปกรณ์</p>
      )}
      {devices.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-white">{parseUA(d.user_agent)}</p>
            <p className="text-xs text-white/40">
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
      {devices.length > 0 && (
        <button
          onClick={handleSignOutOthers}
          disabled={signingOut}
          className="mt-1 w-full rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
        >
          {signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบทุกอุปกรณ์อื่น"}
        </button>
      )}
    </div>
  );
}
