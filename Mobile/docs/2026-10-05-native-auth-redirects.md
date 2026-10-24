# Supabase native Auth redirects — 2026-10-05

## EN

The hosted MangaDock project `eqgcnoljbiwosecydjqd` now accepts all five native Auth return URLs:

```text
mangadock://auth/callback
mangadock://auth/signup
mangadock://auth/recovery
mangadock://auth/link
mangadock://auth/reauth
```

Before the change, a live diagnostic cancellation flow requesting the native callback returned HTTP 302 to the existing web Site URL, `http://localhost:4000/auth/callback`. That fallback explains why a mobile browser could reach an unavailable local web callback. After the user's CLI login, `whoami` and `projects list` succeeded. Pinned Supabase CLI 2.119.0 pulled the remote configuration into an ignored task directory. A sparse declaration changed only `auth.additional_redirect_urls`, retaining all ten existing web entries and adding the five native entries. `config push` exited 0 and reported one property pushed.

The reviewed pre-push diff contained one update and 17 undeclared remote properties; the post-push diff contained zero updates and the same 17 remote properties with identical values. `config diff --exit-code` returned 2 in both cases because undeclared remote properties count as drift; this is not evidence of a remaining actionable update. Site URL, provider settings, database and storage configuration were preserved.

Live verification passed **7/7 HTTP 302 destination checks**: Google and Facebook to the native callback, Google to signup/recovery/link/reauth, and Google to the original web callback. Each probe initiated an Auth flow and immediately returned an explicit diagnostic `access_denied` cancellation, comparing the destination scheme/host/path. No actual provider sign-in, account creation or token exchange was tested. Close the earlier browser error and retry social login in the installed app; this cloud configuration change does not require rebuilding the app.

Operational lessons: the first `config pull` failed with `ConfigPullLoadConfigError` until the isolated workdir was initialized. CLI diff output included text before its JSON record; whole-output JSON parsing failed, then line-based JSON parsing succeeded. Neither failure mutated the cloud configuration. Private original configuration, diffs, push receipt and redirect results remain under ignored `Mobile/.expo/supabase-native-redirects-2026-10-05`; do not commit these artifacts or credentials.

Scope: hosted Auth redirect settings and tracked documentation only. No application source, dependency, Frontend/Backend business contract or MIT component changed in this step; source test/build results from earlier checkpoints are not new verification here. Actual Google/Facebook login and device return/session acceptance remain open. To roll back, refresh the current remote configuration, remove only the five additions above, review the sparse diff and push; retain all current web URLs and unrelated properties.

## TH

เพิ่ม URL กลับเข้าแอปทั้งห้าค่าใน Supabase โครงการ MangaDock แล้ว โดยคง URL เว็บเดิมทั้ง 10 ค่าและ Site URL เดิม ใช้ CLI 2.119.0 หลังผู้ใช้ login สำเร็จ เปลี่ยนเฉพาะ `auth.additional_redirect_urls` ผ่าน sparse config ผล push exit 0 ระบุแก้หนึ่ง property ผล diff หลังแก้เหลือ update 0 และ remote properties อีก 17 ค่าเท่าเดิมทั้งหมด ส่วน exit 2 ของ diff มาจาก properties ที่ไม่ได้ประกาศใน sparse config

ก่อนแก้ native callback ถูกส่งไป `http://localhost:4000/auth/callback` หลังแก้ตรวจ Supabase จริงผ่าน 7/7: callback ของ Google/Facebook, signup/recovery/link/reauth และ callback เว็บเดิม ทุกครั้งใช้ flow ที่ยกเลิกเพื่อวินิจฉัย ไม่ได้ login บัญชีจริง สร้างบัญชีหรือแลก token ให้ปิดหน้า error เก่าแล้วลอง social login ในแอปใหม่ได้เลย การแก้ cloud config นี้ไม่ต้อง build แอปใหม่ ยังต้องตรวจ login และการกลับเข้าแอปพร้อม session ด้วยบัญชีจริง

บันทึกข้อผิดพลาดระหว่างทำงาน: ต้อง init workdir ก่อน pull และต้องอ่าน JSON record แยกจากข้อความนำหน้าของ CLI ไม่ใช่ parse stdout ทั้งก้อน Artifacts ส่วนตัวอยู่ใน `.expo` ที่ถูก ignore ไม่เผยแพร่ credentials ไม่เปลี่ยน source แอป Frontend/Backend หรือ MIT หากย้อนกลับให้ pull ค่าล่าสุดและลบเฉพาะ native URL ห้าค่าที่เพิ่ม ตรวจ diff แล้ว push โดยคงค่าเว็บและ settings อื่นทั้งหมด
