// Maps a Supabase OAuth error (from the popup callback) to a friendly,
// actionable message. Pure — unit-tested in oauth.test.ts. The most important
// case is the manual-linking conflict: a fresh OAuth sign-in onto an email that
// already has an account is refused (anti-takeover), and the user must sign in
// with their existing provider, then link the new one in Account.

export function mapOAuthError(errorCode: string | null | undefined, errorDesc: string | null | undefined): string {
  const code = (errorCode ?? "").trim();
  const desc = (errorDesc ?? "").trim();

  if (code === "identity_already_exists") {
    return "This account is already linked to another login.";
  }
  if (code === "email_exists") {
    return "This email already has an account — sign in with email/password instead.";
  }
  // The linking-domain conflict: manual linking is on, so a fresh sign-in won't
  // auto-merge into the existing email account.
  if (/multiple accounts/i.test(desc) || /linking domain/i.test(desc)) {
    return "This email already has an account. Sign in with your existing provider, then link this one in Account.";
  }
  return desc || "Sign-in failed — please try again.";
}
