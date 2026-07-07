"use client";

import { useState, useEffect } from "react";
import { Activity, Loader2, Mail, Lock } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { useDevAuth, type OAuthProvider } from "@/components/auth-gate";
import { GithubGlyph, GoogleGlyph, FacebookGlyph } from "@/components/provider-glyphs";
import { mapOAuthError } from "@/lib/oauth";

type Mode = "signin" | "signup" | "reset";

// The Dev-console sign-in screen — same providers as the Frontend (Email +
// Google + Facebook) plus GitHub. Live data needs dev access (GitHub identity),
// but anyone can sign in here and link GitHub from Account afterwards.
export function LoginScreen() {
  const { lang } = useLang();
  const th = lang === "th";
  const { signInOAuth, signInEmail, signUpEmail, resetPassword } = useDevAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Surface an OAuth error the redirect carried back to the home URL — either our
  // mapped `?auth_error=`, or Supabase's raw `error`/`error_description` in the
  // query OR the hash (implicit flow).
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const mapped = search.get("auth_error");
    const code = search.get("error_code") || hash.get("error_code");
    const desc = search.get("error_description") || hash.get("error_description");
    const err = search.get("error") || hash.get("error");
    const msg = mapped || ((err || code) ? mapOAuthError(code, desc || err) : null);
    if (msg) {
      setError(msg);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key); setError(null); setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg) setError(msg);
    } finally {
      setBusy(null);
    }
  };

  const oauth = (p: OAuthProvider) => run(p, () => signInOAuth(p));
  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "reset") return run("email", () => resetPassword(email), th ? "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว ตรวจสอบ inbox" : "Password reset link sent — check your inbox");
    if (mode === "signup") return run("email", () => signUpEmail(email, password), th ? "สมัครแล้ว — ยืนยันอีเมลใน inbox" : "Signed up — confirm via the email in your inbox");
    return run("email", () => signInEmail(email, password));
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[360px]">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: "var(--mit)" }}>
            <Activity size={19} strokeWidth={2.25} style={{ color: "#06140a" }} />
          </span>
          <div className="leading-none">
            <div className="text-[16px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>MIT Dashboard</div>
            <div className="mt-1 text-[11.5px]" style={{ color: "var(--ink-3)" }}>{th ? "คอนโซลสังเกตการณ์ระบบ" : "Mission-control observability"}</div>
          </div>
        </div>

        <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
          {mode === "signup" ? (th ? "สร้างบัญชี" : "Create account") : mode === "reset" ? (th ? "รีเซ็ตรหัสผ่าน" : "Reset password") : (th ? "เข้าสู่ระบบ" : "Sign in")}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {th ? "ข้อมูลสดระดับ Dev ต้องเชื่อม GitHub (เชื่อมได้ในหน้า Account หลังเข้าสู่ระบบ)" : "Live Dev data needs a linked GitHub identity (link it in Account after signing in)."}
        </p>

        {/* OAuth providers */}
        <div className="mt-5 flex flex-col gap-2.5">
          <OAuthButton primary onClick={() => oauth("github")} busy={busy === "github"} glyph={<GithubGlyph />} label={th ? "เข้าสู่ระบบด้วย GitHub" : "Continue with GitHub"} />
          <OAuthButton onClick={() => oauth("google")} busy={busy === "google"} glyph={<GoogleGlyph />} label={th ? "เข้าสู่ระบบด้วย Google" : "Continue with Google"} />
          <OAuthButton onClick={() => oauth("facebook")} busy={busy === "facebook"} glyph={<FacebookGlyph />} label={th ? "เข้าสู่ระบบด้วย Facebook" : "Continue with Facebook"} />
        </div>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1" style={{ background: "var(--hairline)" }} />
          <span className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{th ? "หรืออีเมล" : "or email"}</span>
          <span className="h-px flex-1" style={{ background: "var(--hairline)" }} />
        </div>

        {/* Email / password */}
        <form onSubmit={submitEmail} className="flex flex-col gap-2.5">
          <Field icon={<Mail size={14} />}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={th ? "อีเมล" : "Email"}
              className="w-full bg-transparent text-[13px] outline-none" style={{ color: "var(--ink)" }} />
          </Field>
          {mode !== "reset" && (
            <Field icon={<Lock size={14} />}>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={th ? "รหัสผ่าน" : "Password"}
                className="w-full bg-transparent text-[13px] outline-none" style={{ color: "var(--ink)" }} />
            </Field>
          )}
          <button type="submit" disabled={busy === "email"}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--ink)", color: "var(--bg)" }}>
            {busy === "email" && <Loader2 size={14} className="animate-spin" />}
            {mode === "signup" ? (th ? "สมัครสมาชิก" : "Sign up") : mode === "reset" ? (th ? "ส่งลิงก์รีเซ็ต" : "Send reset link") : (th ? "เข้าสู่ระบบ" : "Sign in")}
          </button>
        </form>

        {error && <p className="mt-3 text-[12px]" style={{ color: "var(--error)" }}>{error}</p>}
        {notice && <p className="mt-3 text-[12px]" style={{ color: "var(--success)" }}>{notice}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
          {mode !== "signup" && <button onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className="hover:underline">{th ? "สร้างบัญชีใหม่" : "Create account"}</button>}
          {mode !== "signin" && <button onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="hover:underline">{th ? "มีบัญชีแล้ว เข้าสู่ระบบ" : "Have an account? Sign in"}</button>}
          {mode === "signin" && <button onClick={() => { setMode("reset"); setError(null); setNotice(null); }} className="hover:underline">{th ? "ลืมรหัสผ่าน?" : "Forgot password?"}</button>}
        </div>

        <p className="mt-5 text-[11px]" style={{ color: "var(--ink-3)" }}>
          {th ? "ตรวจสอบสิทธิ์ผ่าน Supabase · ไม่มี shared secret" : "Verified via Supabase · no shared secret"}
        </p>
      </div>
    </div>
  );
}

function OAuthButton({ onClick, busy, glyph, label, primary }: { onClick: () => void; busy: boolean; glyph: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl py-2.5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
      style={primary ? { background: "var(--ink)", color: "var(--bg)" } : { background: "transparent", color: "var(--ink-2)", border: "1px solid var(--hairline)" }}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : glyph}
      {label}
    </button>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
      <span style={{ color: "var(--ink-3)" }}>{icon}</span>
      {children}
    </div>
  );
}
