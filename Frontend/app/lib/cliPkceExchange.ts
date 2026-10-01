/** Exchange without mutating the shared SDK session; the caller commits only an active result. */
export async function exchangeCliPkceCode(code: string, signal: AbortSignal) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const verifierKey = `sb-${new URL(projectUrl).hostname.split(".")[0]}-auth-token-code-verifier`;
  const storedVerifier = window.localStorage.getItem(verifierKey);
  const parsed: unknown = storedVerifier ? JSON.parse(storedVerifier) : null;
  const verifier = typeof parsed === "string" ? parsed.split("/")[0] : null;
  if (!verifier) throw new Error("ไม่พบข้อมูลยืนยันการเข้าสู่ระบบ กรุณาเริ่มใหม่");

  const response = await fetch(`${projectUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {apikey: publicKey, Authorization: `Bearer ${publicKey}`, "Content-Type": "application/json"},
    body: JSON.stringify({auth_code: code, code_verifier: verifier}),
    signal,
  });
  const payload = await response.json();
  if (signal.aborted) throw new Error("Native login was cancelled");
  if (!response.ok || typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") {
    throw new Error(payload.msg ?? payload.error_description ?? "ไม่สามารถยืนยันการเข้าสู่ระบบได้");
  }
  // A newer attempt may already have generated another verifier.
  if (window.localStorage.getItem(verifierKey) === storedVerifier) window.localStorage.removeItem(verifierKey);
  return {access_token: payload.access_token, refresh_token: payload.refresh_token};
}
