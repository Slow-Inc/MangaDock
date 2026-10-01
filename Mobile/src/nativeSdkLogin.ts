export type NativeSdkModule = {
  signIn(provider: 'google' | 'facebook', requestId: string): Promise<unknown>;
  cancel(requestId: string): void;
};
type Result = Record<string, string | undefined>;
type Request = {provider: 'google' | 'facebook'; requestId: string};

/** Owns a single SDK request; destroyed WebViews never receive a session. */
export function createNativeSdkLoginController(
  module: NativeSdkModule,
  callbacks: {onResult(result: Result): void; onPending(request: Request | null): void},
) {
  let active: (Request & {timer: ReturnType<typeof setTimeout>}) | null = null;
  const finish = (request: NonNullable<typeof active>, result?: Result) => {
    if (active !== request) return;
    active = null;
    clearTimeout(request.timer);
    if (result) callbacks.onResult({request_id: request.requestId, ...result});
    callbacks.onPending(null);
  };
  const cancel = (deliver = true) => {
    const request = active;
    if (!request) return;
    finish(request, deliver ? {error: 'ยกเลิกการเข้าสู่ระบบแล้ว'} : undefined);
    module.cancel(request.requestId);
  };
  return {
    start(provider: Request['provider'], requestId: string) {
      cancel();
      const request = {provider, requestId, timer: setTimeout(() => {
        if (active !== request) return;
        finish(request, {error: 'การเข้าสู่ระบบหมดเวลา กรุณาลองอีกครั้ง'});
        module.cancel(requestId);
      }, 120000)};
      active = request;
      callbacks.onPending(request);
      // Invoke synchronously so provider UI is initiated by this button request.
      try {
        module.signIn(provider, requestId).then(value => {
          if (active !== request) return;
          const session = value as {access_token?: unknown; refresh_token?: unknown} | null;
          if (typeof session?.access_token !== 'string' || !session.access_token ||
              typeof session.refresh_token !== 'string' || !session.refresh_token) {
            finish(request, {error: 'ผลการเข้าสู่ระบบไม่ถูกต้อง กรุณาลองใหม่'});
            return;
          }
          finish(request, {access_token: session.access_token, refresh_token: session.refresh_token});
        }, error => {
          const messages: Record<string, string> = {
            'auth/sdk-cancelled': provider === 'google' ? 'Google ไม่สามารถดำเนินการเข้าสู่ระบบต่อได้ หรือหน้าล็อกอินถูกปิด กรุณาลองอีกครั้ง' : 'ยกเลิกการเข้าสู่ระบบแล้ว',
            'auth/sdk-config': 'ยังไม่ได้ตั้งค่า SDK สำหรับผู้ให้บริการนี้',
            'auth/sdk-facebook-config': 'ยังไม่ได้ตั้งค่า Facebook SDK กรุณาเพิ่ม App ID และ Client Token แล้วติดตั้ง APK ใหม่',
            'auth/sdk-no-credential': 'ไม่พบบัญชี Google ที่ใช้ได้ กรุณาตรวจบัญชีและการตั้งค่า Android Client ID',
            'auth/sdk-facebook-token': 'Facebook ไม่ส่ง ID token ที่รองรับ กรุณาตรวจการตั้งค่า SDK',
            'auth/sdk-exchange': 'ไม่สามารถยืนยันบัญชีกับ Supabase ได้ กรุณาตรวจการตั้งค่าผู้ให้บริการ',
          };
          finish(request, {error: messages[error?.code] ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง'});
        });
      } catch {
        finish(request, {error: 'ไม่สามารถเริ่ม SDK สำหรับเข้าสู่ระบบได้'});
      }
    },
    cancel: () => cancel(),
    dispose: () => cancel(false),
  };
}
