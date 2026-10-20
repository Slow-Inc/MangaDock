import { ROLE } from "../../lib/types/user";

/**
 * What the admin layout does while auth resolves (#817). AuthContext starts with user = null and
 * loading = true, so "no user yet" must wait instead of redirecting — otherwise a direct load or a refresh
 * of /admin bounces an admin home before the session arrives. UI gate only; the backend AdminGuard decides.
 */
export function adminGate({ user, loading }: { user: { role?: number | null } | null; loading: boolean }): "wait" | "redirect" | "allow" {
  if (loading) return "wait";
  return user && (user.role ?? 0) >= ROLE.ADMIN ? "allow" : "redirect";
}
