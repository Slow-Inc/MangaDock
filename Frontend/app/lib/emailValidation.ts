const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemail.net",
  "fakemailgenerator.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "moakt.com",
  "nada.email",
  "sharklasers.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "temporary-mail.net",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

export type SignupEmailValidationResult = {
  ok: boolean;
  decision: "allow" | "block" | "warn";
  normalizedEmail: string;
  source: "abstract" | "cache" | "provider-disabled" | "provider-error";
  provider: string | null;
  reason: string | null;
  message: string | null;
  warning: string | null;
  checks: {
    status: string | null;
    statusDetail: string | null;
    formatValid: boolean | null;
    mxValid: boolean | null;
    smtpValid: boolean | null;
    disposable: boolean | null;
    role: boolean | null;
    catchAll: boolean | null;
  };
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  return atIndex >= 0 ? normalized.slice(atIndex + 1) : "";
}

export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export function getDisposableEmailError(email: string): string | null {
  return isDisposableEmail(email)
    ? "ไม่อนุญาตให้ใช้อีเมลชั่วคราวหรืออีเมลปลอมในการสมัครสมาชิก"
    : null;
}

export async function validateEmailBeforeSignup(
  email: string,
): Promise<SignupEmailValidationResult> {
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch("/api/proxy/users/validate-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  if (!response.ok) {
    throw new Error("ไม่สามารถตรวจสอบอีเมลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
  }

  return (await response.json()) as SignupEmailValidationResult;
}