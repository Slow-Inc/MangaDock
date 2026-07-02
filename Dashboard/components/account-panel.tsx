"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { X, Loader2, Check, Lock } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { useDevAuth, type OAuthProvider } from "@/components/auth-gate";
import { accountConnections, type ConnectionRow } from "@/lib/account";
import { GithubGlyph, GoogleGlyph, FacebookGlyph } from "@/components/provider-glyphs";

// The dashboard's own multi-provider linking (standalone — doesn't depend on the
// Frontend). A moderator can sign in with Google, a dev links GitHub, an admin
// holds both; plus an email/password credential. PRD #279, ADR 016 role model.

const OAUTH: { provider: OAuthProvider; label: string; glyph: React.ReactNode }[] = [
  { provider: "github", label: "GitHub", glyph: <GithubGlyph /> },
  { provider: "google", label: "Google", glyph: <GoogleGlyph size={16} /> },
  { provider: "facebook", label: "Facebook", glyph: <FacebookGlyph /> },
];

export function AccountPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const th = lang === "th";
  const { user, getIdentities, linkOAuth, unlinkProvider, addPassword } = useDevAuth();

  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwdOpen, setPwdOpen] = useState(false);

  const load = useCallback(async () => {
    const ids = await getIdentities();
    setIdentities(ids);
    setRows(accountConnections(ids.map((i) => ({ identity_id: i.identity_id, provider: i.provider })), OAUTH));
  }, [getIdentities]);

  useEffect(() => { if (open) { setError(null); load(); } }, [open, load]);

  if (!open) return null;

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); if (m) setError(m); }
    finally { setBusy(null); }
  };

  const hasEmail = identities.some((i) => i.provider === "email");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "color-mix(in oklch, black 55%, transparent)" }} onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{th ? "การเชื่อมต่อบัญชี" : "Account connections"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:opacity-80"><X size={16} style={{ color: "var(--ink-3)" }} /></button>
        </div>
        <p className="mb-4 text-[12px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {user?.email}{user?.email ? " · " : ""}{th ? "เชื่อม GitHub เพื่อปลดล็อกข้อมูลสดระดับ Dev" : "Link GitHub to unlock live Dev data."}
        </p>

        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const glyph = OAUTH.find((o) => o.provider === row.provider)?.glyph;
            return (
              <div key={row.provider} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--panel)", border: "1px solid var(--panel-hairline)" }}>
                <span className="flex h-5 w-5 items-center justify-center" style={{ color: "var(--ink-2)" }}>{glyph}</span>
                <span className="flex-1 text-[13px] font-medium" style={{ color: "var(--ink)" }}>{row.label}</span>
                {row.linked ? (
                  <>
                    <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--success)" }}><Check size={13} /> {th ? "เชื่อมแล้ว" : "Connected"}</span>
                    {row.canUnlink && (
                      <button onClick={() => act(`unlink-${row.provider}`, () => unlinkProvider(identities.find((i) => i.identity_id === row.identityId)!))} disabled={!!busy}
                        className="rounded-lg px-2 py-1 text-[11.5px] transition-opacity hover:opacity-80 disabled:opacity-50" style={{ color: "var(--ink-3)", border: "1px solid var(--hairline)" }}>
                        {busy === `unlink-${row.provider}` ? <Loader2 size={12} className="animate-spin" /> : (th ? "ยกเลิก" : "Unlink")}
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={() => act(`link-${row.provider}`, () => linkOAuth(row.provider as OAuthProvider))} disabled={!!busy}
                    className="rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: "var(--ink)", color: "var(--bg)" }}>
                    {busy === `link-${row.provider}` ? <Loader2 size={12} className="animate-spin" /> : (th ? "เชื่อม" : "Link")}
                  </button>
                )}
              </div>
            );
          })}

          {/* Email / password credential */}
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--panel)", border: "1px solid var(--panel-hairline)" }}>
            <span className="flex h-5 w-5 items-center justify-center" style={{ color: "var(--ink-2)" }}><Lock size={15} /></span>
            <span className="flex-1 text-[13px] font-medium" style={{ color: "var(--ink)" }}>{th ? "อีเมล / รหัสผ่าน" : "Email / password"}</span>
            {hasEmail ? (
              <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--success)" }}><Check size={13} /> {th ? "ตั้งแล้ว" : "Set"}</span>
            ) : (
              <button onClick={() => setPwdOpen((v) => !v)} disabled={!!busy}
                className="rounded-lg px-2.5 py-1 text-[11.5px] font-medium hover:opacity-90" style={{ background: "var(--ink)", color: "var(--bg)" }}>
                {th ? "ตั้งรหัสผ่าน" : "Set password"}
              </button>
            )}
          </div>
          {pwdOpen && !hasEmail && (
            <div className="flex gap-2">
              <input type="password" minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={th ? "รหัสผ่านใหม่ (≥6)" : "New password (≥6)"}
                className="flex-1 rounded-xl px-3 py-2 text-[13px] outline-none" style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink)" }} />
              <button onClick={() => act("addpwd", () => addPassword(pwd)).then(() => { setPwd(""); setPwdOpen(false); })} disabled={pwd.length < 6 || !!busy}
                className="rounded-xl px-3 py-2 text-[12px] font-medium disabled:opacity-50" style={{ background: "var(--ink)", color: "var(--bg)" }}>
                {busy === "addpwd" ? <Loader2 size={13} className="animate-spin" /> : (th ? "บันทึก" : "Save")}
              </button>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-[12px]" style={{ color: "var(--error)" }}>{error}</p>}
      </div>
    </div>
  );
}
