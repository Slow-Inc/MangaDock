# Native Reader CAPTCHA opening diagnostics — 2026-10-05

Follow-up / ผลติดตาม: the missing URL diagnosis below is historical. [Deployment setup](2026-10-05-reader-captcha-setup.md) now records the live development page, corrected Expo env aliases and verified fresh Metro bundle. Actual browser/device return remains unverified.

ผลติดตาม: การไม่มี URL ด้านล่างเป็นประวัติก่อนแก้ รายงาน setup ด้านบนบันทึกหน้าพัฒนาที่ deploy จริง aliases env Expo ที่แก้แล้วและ bundle Metro ใหม่ที่ตรวจแล้ว ยังไม่ยืนยันการกลับเข้าแอปบน browser/อุปกรณ์จริง
## EN

The configured local Mobile environment has no `EXPO_PUBLIC_CAPTCHA_URL`. `NativeReadingView.tsx` passes an empty string to the Reader controller. `verifyCaptcha()` rejects an empty URL with “ยังไม่สามารถเปิดหน้าตรวจสอบได้ กรุณาลองใหม่ภายหลัง” before calling the browser adapter. This is the proven immediate cause of that message; no browser or Cloudflare network error is needed to reproduce it.

A minimal diagnostic invoked the actual Reader module against an external HTTP fixture returning 401. With the current missing URL, it produced that exact error and called the browser adapter zero times. Changing only the URL to a valid HTTPS fixture URL produced no error and called the adapter once; the adapter returned cancellation. This control proves the configuration gate, not real hosting or Turnstile success. Existing Reader and CAPTCHA protocol tests passed 19/19, exit 0.

The checked-in `captcha/config.js` also has an empty public Turnstile site key. Frontend private environment contains a public site key and Backend private environment contains a server secret; neither credential value was printed. Those facts do not prove a deployed CAPTCHA page or a matching allowed hostname. The startup `validate:env` script checks only API URL and Supabase public values, so its success does not validate Reader CAPTCHA configuration.

Required deployment setup: host all files from `Mobile/captcha/` on an owned HTTPS host; configure the public Turnstile site key for that hostname and ensure its paired secret remains in Backend; set `EXPO_PUBLIC_CAPTCHA_URL` to the real hosted `index.html`; restart Metro and reload the app so Expo embeds the updated public value. The page returns to `mangadock://captcha/callback`; the existing Backend `books/verify-captcha` verifies the challenge and issues clearance. Do not substitute a Supabase redirect URL, Cloudflare Dashboard URL or MCP endpoint for the hosted page. No hostname or deployment has been invented or published in this diagnostic.

Discovery notes: tokensave_context did not return within the 10-second bound and `.tokensave/tokensave.db` was absent, so targeted known-file reads were used. A guessed `captcha/app.js` read failed; the page actually has its script inline in `index.html`. No application source, private environment or remote setting was changed. Actual hosted widget/browser/device clearance acceptance remains unverified.

## TH

พบว่า `.env` ของ Mobile ไม่มี `EXPO_PUBLIC_CAPTCHA_URL` ทำให้ `NativeReadingView.tsx` ส่ง URL ว่างให้ Reader และ `verifyCaptcha()` แสดง “ยังไม่สามารถเปิดหน้าตรวจสอบได้ กรุณาลองใหม่ภายหลัง” ก่อนเรียก browser จึงพิสูจน์สาเหตุของข้อความนี้ได้โดยไม่ต้องเกิด network error

ทดสอบด้วย Reader module จริงและ HTTP fixture ที่ตอบ 401: ใช้ URL จาก env ปัจจุบันได้ข้อความเดียวกันและไม่เรียก browser เลย เปลี่ยนเฉพาะ URL เป็น HTTPS fixture เรียก browser หนึ่งครั้งและไม่เกิด error โดย adapter ตอบ cancellation การทดลองนี้พิสูจน์ configuration gate ไม่ได้ยืนยัน hosting หรือ Turnstile จริง Tests Reader และ protocol CAPTCHA เดิมผ่าน 19/19 exit 0

ไฟล์ `captcha/config.js` ใน repo ยังไม่ได้ตั้ง public Turnstile site key พบ public site key ใน env ส่วนตัวของ Frontend และ secret ใน Backend แต่ไม่ได้พิมพ์ค่าออกมาและยังไม่ได้พิสูจน์ว่าตรงกับ hostname ที่อนุญาตหรือมีหน้า deploy แล้ว `validate:env` ตรวจเฉพาะ URL API และ public values ของ Supabase จึงผ่านได้แม้ Reader CAPTCHA ยังไม่พร้อม

ต้อง host ไฟล์ทั้งหมดจาก `Mobile/captcha/` บน HTTPS ที่เป็นเจ้าของ ตั้ง public site key ของ Turnstile ให้ใช้กับ hostname นั้นและคง secret คู่กันใน Backend ตั้ง `EXPO_PUBLIC_CAPTCHA_URL` เป็น URL ของ `index.html` ที่เผยแพร่จริง แล้ว restart Metro และ reload แอปเพื่อรับ public value ใหม่ หน้าตรวจกลับเข้าแอปผ่าน `mangadock://captcha/callback` และ Backend `books/verify-captcha` เดิมตรวจ token เพื่อออก clearance ไม่ใช้ Supabase redirect, URL Dashboard Cloudflare หรือ MCP endpoint แทนหน้าตรวจ ไม่มีการสร้างชื่อ host หรือเผยแพร่ deployment ขึ้นมาเอง

บันทึกการค้นหา: tokensave_context ไม่ตอบภายใน 10 วินาทีและไม่มี `.tokensave/tokensave.db` จึงอ่านเฉพาะไฟล์ที่เกี่ยวข้อง การอ่าน `captcha/app.js` ที่คาดไว้ไม่พบไฟล์ เพราะ script อยู่ใน `index.html` ไม่แก้ source แอป env ส่วนตัวหรือ settings ภายนอก ยังไม่ยืนยัน widget/browser/clearance บนอุปกรณ์จริง

Reference / อ้างอิง: [Cloudflare Turnstile setup](https://developers.cloudflare.com/turnstile/get-started/).
