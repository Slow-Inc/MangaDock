# Native acceptance execution — 2026-10-16

Follow-up to the [status audit](2026-10-16-native-status-audit.md) and execution of the [approved plan](../../docs/superpowers/plans/2026-10-16-native-acceptance-and-release.md). **The replacement release is not accepted yet.** See the [29-slice checklist](2026-10-16-native-acceptance-checklist.md) for individual gates.

ภาษาไทย: ลงมือทำต่อจาก audit ตามแผนที่อนุมัติแล้ว **ยังไม่รับรอง replacement release** ดูสถานะแยก scenario ใน checklist ครบ 29 slices ผลด้านล่างไม่แทนการตรวจบนมือถือจริง

## Outcome / ผลรอบนี้

| Task | Observed result / ผลที่เห็นจริง | Remaining / งานค้าง |
| --- | --- | --- |
| 0 | Complete: 29-slice matrix, AVD/APK/native-module and role inventory / จัด matrix และตรวจ inventory แล้ว | No attached Android or designated test roles / ยังไม่มีอุปกรณ์ต่อหรือบัญชีทดสอบที่ระบุ |
| 1 | Existing Supabase restored to ACTIVE_HEALTHY; DNS and Auth settings HTTP 200; Backend 4001 and Metro 8081 running / กู้ project เดิมและเปิดบริการแล้ว | MIT runtime/models absent; Redis unavailable; device endpoint/reload unobserved / ขาด MIT, Redis และตรวจปลายทางบนเครื่อง |
| 2 | Seven Auth destination probes; live Reader controller reaches 30 pages with simulated browser; empty-page defect fixed / ตรวจ redirect และ Reader ระดับ controller พร้อมแก้ตอนว่าง | Actual provider sign-in, MFA, OS browser return and gestures / login จริง MFA กลับแอปและ gestures |
| 3 | Runtime inventory only / ตรวจ prerequisites | MIT not ready; no real single/batch translation acceptance / ยังไม่รับแปลจริง |
| 4 | Existing source tests remain green / tests เดิมผ่าน | Authorized provider payment fixture and account required / ต้องมีบัญชีและ payment fixture |
| 5 | Existing source tests remain green / tests เดิมผ่าน | Owned reader/creator/staff fixtures and native media interactions / ต้องตรวจบัญชีตามสิทธิ์และ media บนเครื่อง |
| 6 | Original responsive reference retained / คงต้นแบบเดิม | Matching-data web/native captures and physical interaction / ภาพข้อมูลตรงกันและตรวจเครื่องจริง |
| 7 | Debug APK certificate/ABI and release configuration inspected / ตรวจ certificate, ABI และ config แล้ว | Release host/keys/project/signing and physical install/upgrade acceptance / ยังขาด release inputs และรับบนเครื่อง |

## Service and boundary evidence / หลักฐานบริการและขอบเขต

- Supabase project `eqgcnoljbiwosecydjqd` was INACTIVE at audit time, then restored through MCP to ACTIVE_HEALTHY. No replacement project or account was created; no schema or Auth-setting change was made in this execution. Google/Facebook are enabled. Seven diagnostic cancellation flows returned to the requested destinations: both providers to `mangadock://auth/callback`, Google to native signup/recovery/link/reauth and one existing web callback. These short-lived diagnostic flows were cancelled before provider sign-in/token exchange; they are not proof of actual login or revalidation of every old web redirect.
- Backend compiled with zero errors and `/status` returned 200. Startup showed Redis connection refused and existing JSON/L3 fallback. Its status response does not establish actual Redis connectivity. Docker CLI exists but its engine is stopped. No Backend source or cache infrastructure was changed.
- Metro `/status` passed. Fresh Android bundle HTTP 200, 6,949,894 characters; all four configured Expo public values present, checked server variable names `GITHUB_TOKEN` and `TURNSTILE_SECRET_KEY` absent. Initial bundle inspection timed out; the later bounded retry passed. No credential values were printed or saved in evidence.
- Backend targets MIT at `http://localhost:5003`, but `MIT/.venv`, models and a listening service are absent. RTX 4060 hardware is available; that alone is not a runnable deployment. No Python/CUDA/model installation or large download was started while local-versus-existing-server selection is pending.

ภาษาไทย: Supabase เดิมเปลี่ยนจาก INACTIVE เป็น ACTIVE_HEALTHY ผ่าน MCP ไม่สร้าง project/บัญชีใหม่หรือแก้ schema/Auth settings รอบนี้ ตรวจ redirect เจ็ด flow ด้วยการยกเลิกก่อน login/แลก token ไม่ใช่ login จริง Backend compile ผ่านและ HTTP 200 แต่ Redis ไม่เชื่อมต่อ ใช้ fallback เดิม Docker engine หยุดอยู่ ไม่แก้ Backend หรือสร้าง cache ใหม่ Metro bundle ใหม่มี public values ครบและไม่พบชื่อตัวแปร server ที่ตรวจ รอบแรก timeout รอบถัดไปผ่าน ไม่แสดง credentials ส่วน MIT ชี้พอร์ต 5003 แต่ไม่มี runtime/models/listener แม้มี GPU จึงยังไม่ติดตั้งหรือดาวน์โหลดก้อนใหญ่ก่อนเลือก deployment

## Reader defect and TDD / บั๊ก Reader และ TDD

The live controller accepted HTTP 200 with `pages: []` as `ready`, leaving an empty reader. A MangaDex Thai fixture independently returned zero images upstream. Another initial English fixture returned 404 from both Backend and upstream; that unavailable content was not treated as an application defect.

Two behavior tests were each observed RED with “Missing expected rejection”, then GREEN after minimal guards in `Mobile/src/reader.ts`: an empty MangaDex chapter and an empty published Studio chapter now reject with an actionable message before publishing a new ready state. The Studio check occurs **after** entitlement gating, and both checks remain inside the current-request generation guard. Existing paid/unlock tests still pass. No API contract or Frontend/Backend/MIT source was changed for this fix.

ภาษาไทย: พบ controller รับ HTTP 200 ที่ `pages: []` เป็นพร้อมอ่านทั้งที่ไม่มีภาพ ยืนยัน MangaDex fixture ว่างจาก upstream ด้วย อีก fixture เป็น 404 ทั้ง Backend/upstream จึงไม่แก้แอปเพื่อกลบเนื้อหาที่ไม่มี เพิ่ม tests สองเส้นทางและเห็น RED จากไม่ reject ก่อนแก้ guard ขั้นต่ำ MangaDex/Studio ให้แจ้งเลือกตอนอื่นก่อนประกาศ ready ใหม่ โดย Studio ตรวจหลัง entitlement และคง generation guard เดิม Tests paid/unlock ยังผ่าน ไม่แก้ API contract หรือ source บริการอื่น

Live success used existing manga `38c6f934-7558-4d1b-80d1-91114e0419eb`, chapter `dcc637dd-797c-4aa3-9a89-8ca5c38adf63`: actual Mobile catalog/Reader controllers called Backend, received the expected 401 CAPTCHA gate, verification 201, then 200 with **30 pages**. The browser boundary returned a public development dummy token through the real callback builder. Evidence level is `LIVE_BACKEND_TEST_CAPTCHA_MOCK_BROWSER`; no real browser/device challenge was observed. One resolved image returned HTTP 200 `image/jpeg`, 811,875 bytes through the existing local image path; bytes were discarded. This does not establish image rendering or production bot protection. Normal service reads may record the diagnostic device/view as existing application behavior.

ภาษาไทย: fixture ข้อมูลจริงด้านบนผ่าน catalog/Reader controller และ Backend จาก 401 ไป verify 201 แล้วได้ 30 หน้า แต่จำลองขอบ browser ด้วย dummy token สำหรับพัฒนา จึงไม่อ้าง CAPTCHA/กลับแอปจริง ภาพแรกตอบ JPEG 811,875 bytes จาก local image path เดิมและทิ้ง bytes หลังตรวจ ไม่อ้าง render/production protection การอ่านผ่านบริการอาจบันทึก diagnostic device/view ตาม behavior เดิม

## Fresh source verification / ตรวจ source ใหม่

| Check | Result |
| --- | --- |
| Empty-page and paid/unlock targeted regressions | 4/4 PASS |
| `npm.cmd test` | **220/220 PASS**, zero failures/skips |
| `npm.cmd run typecheck` | Exit 0 |
| `npm.cmd run validate:env` | Exit 0 |
| `npx.cmd expo export --platform android --output-dir .expo/native-acceptance-2026-10-16/android-export` | Exit 0; 772 modules, ~3 MB Hermes bundle, 11 assets |

The final export includes both guards. It is a JS/assets export, not a new APK. No native module/config change was made in this fix. Prior Backend build/tests remain dated audit evidence rather than a new run. No performance percentage was measured.

ภาษาไทย: export สุดท้ายรวม guard ทั้งสอง แต่เป็น JS/assets ไม่ใช่ APK ใหม่ ไม่เปลี่ยน native module/config รอบแก้นี้ หลักฐาน Backend tests/build เดิมคงวันที่เดิม ไม่อ้างว่ารันใหม่ และไม่วัดเปอร์เซ็นต์ความเร็ว

## Device and release limits / ข้อจำกัดเครื่องและ release

`adb devices -l` has no attached target; AVD `MangaDock_API_36` is available but was not launched. CUA reports no app/browser surfaces, so no automated device interaction or screenshots are claimed. The inspected Oct 5 APK is version 0.1.0/code 1, package `com.mangadock.mobile`, x86_64 only. `apksigner verify --print-certs` succeeds with **Android Debug** certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. APK hash and native package inclusion are in the checklist; DEX strings do not prove OS runtime behavior.

The existing EAS project ID is empty, local release uses debug signing, API is emulator-local and CAPTCHA is the always-pass development setup. A release requires its intended reachable host, real matching Turnstile configuration, project/signing ownership and an appropriate device ABI. No production key, EAS project, signing identity or paid build was created; no app was uninstalled or reset.

ภาษาไทย: ยังไม่มี Android ต่อ มี AVD แต่ไม่เปิด CUA ไม่มี surface จึงไม่อ้าง interaction/ภาพ APK เดิมเป็น x86_64 เซ็น Android Debug ตรวจลายเซ็นผ่านแต่ไม่ใช่ release และ strings packages ไม่ยืนยัน runtime ต้องมี host/Turnstile จริง/project/signing และ ABI ตรงเครื่องก่อนสร้าง release ไม่สร้าง keys/project/build ที่มีค่าใช้จ่าย ไม่ถอนแอปหรือล้างข้อมูล

## Reproducibility and next inputs / หลักฐานและข้อมูลที่ต้องมีต่อ

Redacted machine evidence and test log are retained locally in `.superpowers/sdd/2026-10-16-native-acceptance-and-release/` (ignored): Auth destination checks, bundle checks, before/after empty Reader, live Reader calls, image metadata and final test log. This report preserves the essential results without relying on ignored files for the conclusion. Tokensave graph requests timed out and its SQLite fallback was absent; targeted known-file reads were used. A failed upstream-document fetch did not supply evidence or justify a dependency change.

Next inputs are the Android target (physical USB or emulator), MIT deployment choice (existing server or local installation), and designated existing test accounts/roles/payment fixtures through user-operated login. Release ownership/HTTPS/signing inputs follow the device/service checks. Backend and Metro were left running. No commit, push, PR, merge or issue closure was performed; no new feature tickets were published.

ภาษาไทย: เก็บหลักฐานที่ปิดข้อมูลส่วนตัวใน workspace ignored ตาม path ด้านบน รายงานนี้มีสาระสำคัญครบแม้ไม่ส่งไฟล์ ignored Tokensave timeout และไม่มี SQLite fallback จึงอ่านไฟล์ที่ทราบตำแหน่ง ไม่ใช้การ fetch เอกสาร upstream ที่ล้มเหลวเป็นหลักฐาน ต่อไปต้องเลือกอุปกรณ์และ MIT พร้อมบัญชี/roles/payment fixtures ที่มีสิทธิ์โดยผู้ใช้ login เอง แล้วจึงเตรียม ownership/HTTPS/signing เปิด Backend/Metro ค้างไว้ ไม่ commit/push/PR/merge/ปิด issue หรือสร้าง tickets ใหม่
