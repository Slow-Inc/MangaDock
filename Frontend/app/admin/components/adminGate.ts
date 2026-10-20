import { ROLE } from "../../lib/types/user";

const isAdmin = (role: number | null | undefined) => (role ?? 0) >= ROLE.ADMIN;

/**
 * What the admin layout does while auth resolves (#817). AuthContext starts with user = null and
 * loading = true, so "no user yet" must wait instead of redirecting. And the JWT role can lag: an admin
 * promoted in the panel has the role only in profiles.role, so a non-admin JWT waits for `profileRole`
 * (GET /users/me; undefined while in flight) before redirecting. UI gate only — the backend AdminGuard decides.
 */
export function adminGate({
  user,
  loading,
  profileRole,
}: {
  user: { role?: number | null } | null;
  loading: boolean;
  profileRole: number | null | undefined;
}): "wait" | "redirect" | "allow" {
  if (loading) return "wait";
  if (!user) return "redirect";
  if (isAdmin(user.role) || isAdmin(profileRole)) return "allow";
  return profileRole === undefined ? "wait" : "redirect";
}
