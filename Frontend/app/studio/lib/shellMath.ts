/** Small, pure helpers for the Studio shell and overview (Epic C #788). */
import { ROLE, type UserRole } from "../../lib/types/user";

/** Sidebar width limits, as in the Dashboard Shell docs the dev supplied (resizable 180–400 px). */
export const SIDEBAR = { min: 180, max: 400, initial: 220, step: 10 } as const;

export function clampSidebarWidth(w: number): number {
  if (!Number.isFinite(w)) return SIDEBAR.initial;
  return Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, Math.round(w)));
}

/** SVG polyline points for a sparkline in a w × h box; the highest value sits at the top. */
export function sparklinePoints(values: number[], w: number, h: number, pad = 2): string {
  if (values.length === 0) return "";
  const mid = Math.round(h / 2);
  if (values.length === 1) return `${pad},${mid} ${w - pad},${mid}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = Math.round(pad + i * step);
      const y = span === 0 ? mid : Math.round(h - pad - ((v - min) / span) * (h - pad * 2));
      return `${x},${y}`;
    })
    .join(" ");
}

const PAGE_TITLES: Array<[prefix: string, title: string]> = [
  ["/studio/works", "ผลงาน"],
  ["/studio/wallet", "กระเป๋าเงิน"],
  ["/studio/account", "บัญชี"],
  ["/studio/upload", "อัปโหลด"],
  ["/studio/search", "ค้นหามังงะ"],
  ["/studio/manga/", "จัดการเรื่อง"],
];

/** The page title in the shell header, from the route. */
export function studioPageTitle(pathname: string): string {
  if (pathname === "/studio") return "ภาพรวม";
  return PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "สตูดิโอ";
}

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  [ROLE.TRANSLATOR]: "นักแปล",
  [ROLE.CREATOR]: "ครีเอเตอร์",
  [ROLE.ADMIN]: "แอดมิน",
};

/** The status pill in the shell header: the account's Studio role, or null when it has none. */
export function studioRoleLabel(role: UserRole | null | undefined): string | null {
  return role == null ? null : (ROLE_LABELS[role] ?? null);
}

/** Roving focus for a tab list: the index a key moves to (wrapping), or null when the key is not handled. */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
