"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Navbar from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";

const NAV = [
  { href: "/settings/profile",  label: "ข้อมูลส่วนตัว" },
  { href: "/settings/password", label: "รหัสผ่าน" },
  { href: "/settings/accounts", label: "การเชื่อมต่อ" },
  { href: "/settings/security", label: "ความปลอดภัย" },
  { href: "/settings/stats",    label: "สถิติการอ่าน" },
  { href: "/settings/danger",   label: "โซนอันตราย", danger: true },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="min-h-dvh bg-bg pb-20">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-8">
        <h1 className="mb-6 text-lg font-bold text-ink">การตั้งค่า</h1>
        {/* Mobile tab nav */}
        <div className="mb-4 flex gap-1 overflow-x-auto pb-1 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname === item.href
                  ? item.danger ? "bg-danger/10 text-danger" : "bg-fill text-ink"
                  : item.danger ? "text-danger/60" : "text-ink-2"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-6">
          <aside className="hidden w-48 shrink-0 md:block">
            <nav className="space-y-0.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    pathname === item.href
                      ? item.danger ? "bg-danger/10 text-danger" : "bg-fill text-ink"
                      : item.danger ? "text-danger/60 hover:bg-danger/10 hover:text-danger" : "text-ink-2 hover:bg-fill hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
