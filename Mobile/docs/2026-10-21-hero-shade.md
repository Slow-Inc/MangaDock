# Native cover shading — 2026-10-21

## Symptom and cause

The discovery cover had visible horizontal shade bands on Galaxy Z Flip4.
`NativeDiscoveryView.tsx` rendered 20 stacked rectangles, each with a constant
black opacity, increasing by 0.045. The screenshot from the installed original
APK shows these boundaries. The web cover markup was the user's visual
reference; the defect was in the corresponding native hero.

## Change

One continuous native linear gradient replaces the 20 rectangles. The lower
40% of the cover remains shaded from transparent black to 0.855 opacity.
Cover dimensions, clipping, title layout, carousel and detail navigation are
unchanged. No package, backend, auth or payment change is needed.

The change is on `fix/mobile-hero-gradient-20261021`, based on the installed
UX commit `72af504`. See [ADR 032](../../docs/adr/032-mobile-hero-continuous-shade.md).

## Validation and artifact

- Existing Mobile suite: 234/234 passed; TypeScript and env validation passed.
- Android `assembleRelease`: passed, 316 tasks; 2m 38s. No checks excluded.
- APK: `Mobile/build/apk/2026-10-21/MangaDock-0.1.0-hero-smooth-gradient-arm64.apk`.
- SHA-256: `2c0cb084118f177dd16d571fb3745a253a85757243a45ce8ef5f53e49a0b4c51`.
- Size: 27,763,741 bytes; existing version 0.1.0/code 1, ARM64, QA debug signing.
- Galaxy Z Flip4 / Android 16: Play Protect confirmation completed; `install -r`
  succeeded, app cold-launched, installed APK SHA-256 matches the artifact.
- Inspected the same Chainsaw Man cover before and after: the broad horizontal
  bands disappear, while cover and title geometry remain unchanged.
- Additional detail-navigation probing reached a loading state and did not
  finish within the observation window. This is not counted as successful
  detail/Back acceptance. The first probe accepted a hero accessibility label
  as a detail match; that assertion was discarded and tightened.

Screenshots: [before](screenshots/native-hero-shade-before-2026-10-21.png),
[after](screenshots/native-hero-shade-after-2026-10-21.png).

Raw logs, original screenshot, source patch and validation record are local
in `qa/hero-gradient-20261021/`. No new structural style test is added: the
rendering defect requires device-level visual verification.

## Performance and limits

Twenty child Views are removed per mounted cover; speed, GPU and memory changes
are not measured. This addresses discrete horizontal overlays, not every possible
display color-quantization artifact. The pinned React Native API is experimental
and should be checked on upgrades. iOS and other devices are not validated.
Rollback the `NativeDiscoveryView.tsx` diff and reinstall the previous APK.

ภาษาไทย: เปลี่ยนแถบดำ 20 ชั้นเป็น gradient ต่อเนื่อง โดยคงพื้นที่เงาและชื่อเรื่องเดิม
tests 234/234, TypeScript/env และ Android build ผ่าน ติดตั้งบน Z Flip4 แล้ว
hash ตรงกันและภาพปกเดียวกันหลังแก้ไม่เห็นแถบเงาขนาดใหญ่เดิม การตรวจเปิดรายละเอียด
เพิ่มเติมยังค้างสถานะกำลังโหลด จึงไม่นับเป็นผลรับรอง navigation/Back
