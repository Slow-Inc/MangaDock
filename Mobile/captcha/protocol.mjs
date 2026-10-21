export function buildCaptchaCallback(pageUrl, token) {
  const state = new URL(pageUrl).searchParams.get('state');
  if (!state || !/^[A-Za-z0-9_-]{16,128}$/.test(state)) throw new Error('ไม่พบคำขอตรวจสอบจากแอป กรุณากลับไปเปิดใหม่');
  if (typeof token !== 'string' || !token) throw new Error('ยังไม่ได้รับผลการตรวจสอบ');
  const callback = new URL('mangadock://captcha/callback');
  callback.searchParams.set('state', state);
  callback.searchParams.set('token', token);
  return callback.toString();
}
