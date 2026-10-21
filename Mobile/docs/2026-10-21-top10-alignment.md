# Top 10 cover alignment — 2026-10-21

## Symptom and root cause

Top 10 covers appeared at different heights. The ranked row bottom-aligned
whole book cards, whose titles can occupy one or two lines. On Z Flip4 the
original first two covers began at y429 and y372: a 57px difference, exactly
one 19dp title line at 3x density. A fixed 55dp bottom margin also coupled the
rank number to the variable metadata height.

## Fix

`NativeDiscoveryView.tsx` top-aligns ranked cards and gives the rank a frame
matching the cover's 144dp height, derived from its existing 96dp width and
2:3 aspect ratio. Numbers align with the cover bottom independently of the
title and optional metadata. Numeric width stays intrinsic, including 10.
Other book rows and naturally wrapped metadata are unchanged. The preceding
continuous hero-shade fix remains included. No dependency is added.

## Validation

- Existing Mobile suite 234/234, TypeScript and env validation passed.
- Android release build including vital lint passed: 316 tasks, 53s.
- Galaxy Z Flip4 / Android 16: install-r and launch succeeded, installed hash
  matches. All 10 ranks observed through four horizontal-list captures.
- At normal font size, all complete ranked covers start at y397 in the
  recorded sweep; rank boxes end at y829, matching their cover bottoms.
- At font scale 1.5, all ten ranks remain observable, cover tops y434 and
  rank bottoms y866 throughout the sweep. Rank 10 is fully accessible and
  was visually inspected. Restored original font scale 1.0 with read-back.
- The first supplementary sweep started after the visible row had moved
  above the viewport; its missing-cover assertion was discarded. The final
  sweeps establish the starting screen before collecting evidence.

Screenshots: [before](screenshots/native-top10-before-2026-10-21.png),
[after](screenshots/native-top10-after-2026-10-21.png),
[150% font at rank 10](screenshots/native-top10-font150-2026-10-21.png).
Raw XML, images, device assertions and logs: local
`qa/top10-alignment-20261021/` (font test in `font150/`).

## APK and limits

- `Mobile/build/apk/2026-10-21/MangaDock-0.1.0-top10-aligned-arm64.apk`
- SHA-256: `a6065a042fce0619362fc33bc7feaa98ea9367f1b1499f4f1b19dae9009497da`.
- 27,763,829 bytes; version 0.1.0/code 1, ARM64, existing QA debug signing/LAN.
- Runtime speed and memory are not measured. No iOS or narrower-device claim.
- No new structural style test: XML geometry and device rendering verify this
  layout defect. Revert only ranked-layout changes to retain the hero repair.
- See [ADR033](../../docs/adr/033-mobile-ranked-cover-alignment.md).

ภาษาไทย: จัดปก Top10 ชิดบนและยึดเลขอันดับกับขอบล่างปก แก้ความต่าง57pxที่เกิดจาก
ชื่อเรื่องหนึ่งหรือสองบรรทัด tests234/types/env/buildผ่าน ติดตั้งบน Z Flip4 และตรวจ
hashตรงกัน เลื่อนเห็นครบ10อันดับทั้งฟอนต์ปกติและ150% ระดับปก/เลขเท่ากันตาม XML
คืนฟอนต์1.0แล้ว ไม่เปลี่ยนแถวอื่น ไม่อ้างผลบน iOS หรือเครื่องอื่น
