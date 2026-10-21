# Public HTTPS test APK — 2026-10-20 / APK ทดสอบผ่านอินเทอร์เน็ต

Historical delivery record: the source baseline was `443dc808`, before PR #782 and the main integration #877. This APK does not include those later fixes. The results below were recorded on 2026-10-20; publishing this report does not revalidate current endpoint availability or produce a new APK.

ภาษาไทย: บันทึกการส่งย้อนหลังนี้ใช้ source `443dc808` ก่อน PR #782 และการรวม main #877 ดังนั้น APK นี้ยังไม่มี fixes ที่เพิ่มภายหลัง ผลด้านล่างตรวจเมื่อ 2026-10-20 การเผยแพร่รายงานครั้งนี้ไม่ได้ตรวจสถานะ endpoint ปัจจุบันซ้ำหรือสร้าง APK ใหม่

[Download ARM64 APK](https://mobile-download.hayateotsu.space/MangaDock-0.1.0-arm64-https-test.apk) · [API status](https://api.hayateotsu.space/status)

The new artifact embeds `https://api.hayateotsu.space`. It replaces the LAN-only delivery for testers on other networks. Public-domain HTTPS API, protected Reader and a complete APK download passed from the development computer. Actual installation and operation from a phone on another network remain unverified. The earlier [LAN artifact report](2026-10-20-test-apk.md) remains historical evidence for a different binary.

ภาษาไทย: APK ใหม่นี้ฝัง API HTTPS สาธารณะ สำหรับให้ผู้ทดสอบต่างเครือข่ายติดตั้งแทนตัว LAN เดิม ตรวจ API เส้นทางอ่านที่มี CAPTCHA และดาวน์โหลด APK ครบไฟล์ผ่านโดเมนสาธารณะจากคอมพิวเตอร์แล้ว ยังไม่ได้ยืนยันการติดตั้งและใช้งานบนมือถือจริงต่างเครือข่าย รายงาน LAN เดิมเป็นหลักฐานของคนละไฟล์

## Artifact / รายละเอียดไฟล์

| Property / รายการ | Value / ค่า |
| --- | --- |
| Local file / ไฟล์ในเครื่อง | `Mobile/build/apk/2026-10-20-public/MangaDock-0.1.0-arm64-https-test.apk` (ignored) |
| Size / ขนาด | 27,760,053 bytes |
| SHA-256 | `ba8d4f5e6b3a892387f4e27dfe374ba9f283913449f31c5e185e53973c4459bb` |
| Package/version / แพ็กเกจและรุ่น | `com.mangadock.mobile`, 0.1.0/code 1 |
| Android / ระบบ | ARM64 only; min SDK 24, target SDK 36 |
| Signing / ลายเซ็น | Existing Android Debug internal-test certificate / ลายเซ็นทดสอบเดิม |
| Certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Embedded Hermes / JS ที่ฝัง | 2,490,880 bytes; Metro unnecessary / ไม่ต้องเปิด Metro |

## Install and test / ติดตั้งและทดสอบ

1. Download the HTTPS APK above on an ARM64 Android phone and allow installation for that browser when Android requests it. Install the new file over the existing test app if its signing identity matches. A signature conflict needs investigation; do not uninstall and lose local data as a default fix.
2. Switch the phone to mobile data or another Wi-Fi network. Open API status in its browser, then launch the new APK. Test sign-in, search/details, opening a chapter, CAPTCHA browser return and reading images. Record device/Android version, action and observed result without passwords or tokens.
3. Keep the Backend host connected to the internet with Backend and the Cloudflare connector running. The download server is required only while people download files. Installed apps need neither Metro nor the download server.

ภาษาไทย:

1. ดาวน์โหลด APK HTTPS ด้านบนบน Android ARM64 แล้วอนุญาตติดตั้งจากเบราว์เซอร์ตามที่ Android ขอ ติดตั้งทับแอปทดสอบเดิมได้หากลายเซ็นตรงกัน หากลายเซ็นขัดกันให้ตรวจสาเหตุ อย่าเริ่มด้วยการถอนแอปจนข้อมูลในเครื่องหาย
2. เปลี่ยนมือถือเป็นเน็ตมือถือหรือ Wi-Fi คนละวง เปิดลิงก์ API status ในเบราว์เซอร์ แล้วเปิด APK ใหม่ ทดสอบล็อกอิน ค้นหา รายละเอียด เปิดตอน กลับจาก CAPTCHA และอ่านภาพ บันทึกรุ่นเครื่อง Android ขั้นตอนและผล โดยไม่ส่งรหัสผ่านหรือ token
3. เครื่องเจ้าของ Backend ต้องต่ออินเทอร์เน็ตและเปิด Backend กับ Cloudflare connector ค้างไว้ เปิด download server เฉพาะช่วงให้ดาวน์โหลด ติดตั้งแล้วไม่ต้องเปิด Metro หรือ download server เพื่อใช้แอป

## Runtime commands / คำสั่งเปิดระบบ

Run each process in its own PowerShell terminal from the repository root. Services were left running after verification; check `/status` first and do not start another Backend on occupied port 4001.

ภาษาไทย: เปิดแต่ละบริการคนละหน้าต่าง PowerShell จากโฟลเดอร์หลักของโปรเจกต์ ขณะส่งงานเปิดบริการไว้แล้ว ตรวจ `/status` ก่อน อย่าเปิด Backend ซ้ำเมื่อพอร์ต 4001 มีตัวเดิมทำงาน

```powershell
# Backend: only if not already running / เปิดเมื่อยังไม่ทำงาน
Set-Location .\Backend
npm.cmd run start:dev
```

```powershell
# Connector: repository root / จากโฟลเดอร์หลัก
& ".\Mobile\.expo\cloudflare\cloudflared-windows-amd64.exe" tunnel --no-autoupdate --protocol http2 run --token-file ".\Mobile\.expo\cloudflare\tunnel-token.txt"
```

```powershell
# APK download server: repository root / เปิดให้ดาวน์โหลดไฟล์
& "C:\Python314\python.exe" -u -m http.server 8766 --bind 127.0.0.1 --directory ".\Mobile\build\apk\2026-10-20-public"
```

The executable, private token, generated Android tree and build directory are local ignored files. A fresh Git checkout does not contain them. The token file has a restricted user/SYSTEM ACL and sits outside the served directory. This is a development-host service, without Windows service/autostart or always-on production hosting; stopping the host or connector stops public API availability.

ภาษาไทย: executable, token ส่วนตัว, Android ที่ generate และโฟลเดอร์ build เป็นไฟล์ local ที่ ignore จึงไม่มีใน clone ใหม่ token จำกัดสิทธิ์ผู้ใช้/SYSTEM และอยู่นอกโฟลเดอร์ที่ให้ดาวน์โหลด ระบบนี้ยังรันบนเครื่องพัฒนา ไม่ได้ติดตั้ง Windows service/autostart หรือโฮสต์ production ถาวร เมื่อปิดเครื่องหรือ connector API สาธารณะจะหยุด

## Recovery and scope / สิ่งที่แก้และขอบเขต

Before recovery, loopback Backend returned 200 while the public hostname returned HTTP 530 / Cloudflare 1033. The authoritative zone was on a different connected Cloudflare account from the first connector inspected. Its old shared tunnel `narze-dashboard` had no connections. A dedicated remotely managed tunnel `mangadock-mobile-test` was created, connected and verified healthy before changing only the existing API CNAME target. Its routes are API → `http://127.0.0.1:4001`, new download hostname → `http://127.0.0.1:8766`, then 404. The old shared tunnel configuration remains version 7 and was not overwritten. No Frontend, Backend or MIT source, contracts, dependencies or private application env were changed.

ภาษาไทย: ก่อนแก้ Backend ในเครื่องตอบ 200 แต่โดเมนสาธารณะตอบ 530/1033 พบ zone จริงอยู่คนละ Cloudflare account กับ connector ที่ตรวจครั้งแรก และ tunnel ร่วมเดิมไม่มี connection จึงสร้าง tunnel แยกสำหรับ MangaDock เชื่อมต่อจน healthy ก่อนเปลี่ยนเฉพาะ CNAME API เดิม เพิ่มโดเมนโหลด APK ไปพอร์ต loopback 8766 ส่วน API ไป 4001 และปิดท้ายด้วย 404 คง config tunnel ร่วมเดิม version 7 ไม่แก้ source/contracts/dependencies ของ Frontend Backend MIT หรือ private env ของแอป

The portable official cloudflared 2026.10.2 binary matched its release asset SHA-256 (`12c7c887f8aaab779aef1dfa9b60673530a5adb88ecc55dd6df8f56e0b70f199`). An initial Node download timed out; curl's short timeout also proved unsuitable for the observed transfer rate. Resuming that exact immutable asset with a longer timeout succeeded, followed by hash verification. Only the owned download process was stopped. Public API DNS initially continued returning 1033 for approximately two minutes after the targeted change, then passed without further configuration changes.

ภาษาไทย: ตรวจ hash cloudflared 2026.10.2 จาก release ทางการตรงกัน การโหลด Node ครั้งแรกหมดเวลา และ timeout สั้นของ curl ไม่พอกับความเร็วที่พบ จึง resume ไฟล์เดิมด้วยเวลาที่เหมาะสมแล้วตรวจ hash หยุดเฉพาะ process โหลดที่เปิดเอง หลังแก้ DNS ยังพบ 1033 ราวสองนาทีก่อนกลับมาผ่าน โดยไม่เปลี่ยน config เพิ่มระหว่างรอ

References / อ้างอิง: [Cloudflare 1033](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1033/), [connector run parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/).

## Validation and limits / หลักฐานและข้อจำกัด

| Check / ตรวจ | Observed / ผลจริง |
| --- | --- |
| Native build | `assembleRelease`, vital lint exit 0; 2m11s, 316 tasks / build และ vital lint ผ่าน |
| APK inspection | Signature verifies; ARM64; four intended public values present; old LAN/emulator origins absent; checked GitHub/connector private tokens absent / ลายเซ็น ABI และค่าที่ฝังผ่าน ไม่พบค่าลับที่ตรวจ |
| Public API | `/status` HTTP 200 JSON; dedicated tunnel healthy / API ตอบ JSON และ tunnel healthy |
| Protected Reader | Anonymous diagnostic request: pages 401 → development CAPTCHA verification 201 → pages 200, 30 pages; image JPEG 200, 811,875 bytes / ตรวจ Reader จริงด้วย CAPTCHA ทดสอบ ได้ 30 หน้าและภาพ |
| Public APK transfer | 2026-10-20 10:29:39 UTC: HEAD 200, GET 200, 27,760,053 bytes; streamed hash matches above / ดาวน์โหลด HTTPS ครบและ hash ตรง |
| Previous source evidence | Earlier same-day Mobile 220/220, types/env; Backend 90 suites/960 tests; tooling 58/58. Not rerun for this env-only artifact / หลักฐานเดิมวันเดียวกัน ไม่อ้างว่ารัน suite ใหม่รอบนี้ |
| Device/provider/payment/MIT | NOT_RUN or BLOCKED; no attached phone or actual browser interaction; MIT unavailable / ยังไม่รับเครื่องจริง provider payment และ MIT |

Build origin was overridden only in the build process, leaving local `.env` unchanged. Removed only the generated release JS bundle and used `--no-build-cache` to ensure the new embedded API origin; no source edits. Production signing and real CAPTCHA protection remain open; current CAPTCHA is the existing development test pair. Public HTTPS probes ran from the host; the external web tool could not fetch these URLs and supplies no independent network evidence. These results do not assert complete device or production acceptance. No payment or role changes were made, and no issues were closed.

ภาษาไทย: override API เฉพาะ process build คง `.env` เดิม ลบเฉพาะ bundle release ที่ generate และใช้ `--no-build-cache` เพื่อไม่คืนค่าฝังเดิม ไม่แก้ source ยังขาด production signing และ CAPTCHA จริงซึ่งตอนนี้เป็นคู่ทดสอบเดิม การตรวจ HTTPS มาจากเครื่องโฮสต์ เครื่องมือ web ภายนอกดึง URL ไม่ได้จึงไม่ใช่หลักฐานจากเครือข่ายอิสระ ไม่ถือผ่านมือถือหรือ production ทั้งระบบ ไม่ทำธุรกรรม ไม่แก้ role และไม่ปิด issue

Redacted local evidence (ignored): `.superpowers/sdd/2026-10-16-native-acceptance-and-release/` contains `public-reader-verification.json`, `public-apk-download-verification.json`, `apk-https-inspection.json` and `apk-https-2026-10-20-build.log`. Runtime private files remain outside delivery. No new commit/push was performed for this follow-up.

ภาษาไทย: หลักฐาน local ที่ปิดข้อมูลลับแล้วอยู่ในโฟลเดอร์ ignored ด้านบน แยกไฟล์ private ออกจากการส่งดาวน์โหลด รอบแก้ HTTPS นี้ยังไม่ได้ commit/push เพิ่ม

## Rollback inventory / รายการย้อนกลับ

Restore only the API CNAME's old target to undo routing; keep unrelated routes untouched. Resource identifiers below are non-secret. Remove the new download record/tunnel and stop only owned connector/file-server processes if withdrawing this delivery. Do not delete the old shared tunnel.

ภาษาไทย: หากย้อน routing ให้คืนเฉพาะ CNAME API ไป target เดิม คงโดเมนอื่น รหัสทรัพยากรด้านล่างไม่ใช่ secret หากถอนการส่งงานนี้จึงลบ record ดาวน์โหลด/tunnel ใหม่และหยุดเฉพาะ connector/file server ที่เปิดเอง ไม่ลบ tunnel ร่วมเดิม

| Resource / ทรัพยากร | Identifier / รหัส |
| --- | --- |
| Zone | `32af5f332b6a6dee278607de974511d0` |
| Existing API record | `f255792b67a200c44b8901b8f1ddf9f8` |
| Old API target | `1cc9b897-dd4d-436b-aaab-fa73ea3cd34b.cfargotunnel.com` |
| New tunnel/target | `ab5ba8c3-4a28-431b-908f-24eef4c3350a` / same UUID `.cfargotunnel.com` |
| New download record | `52f358a7b8d8fea6a9a4c0cc6336eb1a` |
