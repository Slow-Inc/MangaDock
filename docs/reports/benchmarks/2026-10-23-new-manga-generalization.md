# Generalization test on a brand-new real manga page (Kaguya-sama ch.11, outside the corpus)

- **Date:** 2026-10-23 (round 210) · MangaDex public API -> page 1 downloaded to `tmp` (not committed) -> `doctor_page.py --source ENG --target THA --gate`.
- **Page:** 800 x 1142 colour JPEG, 7 translated regions, wall 16.4 s (cold model load included: detection 5.6 s).

## Result

- **Gate: 0 violations.**
- Translations read naturally (e.g. `ITS AUTUMN READING WEEK!` -> `สัปดาห์อ่านหนังสือฤดูใบไม้ร่วง!`, the long narration line kept its meaning).
- **Render telemetry: `root=1 spill=1`** — one region overflows its container by ~7 px (`container_box` height 137 vs
  `dst_box` height 144, 2.5 px above / 4.5 px below). Visually minor; no text clipping or overlap with art elsewhere.
- Two English art texts stay untranslated because detection never produced regions for them: the overlaid chapter
  subtitle `Chapter 11: Yoshiyuki Wants to Write a Book Report` and the decorative cover lettering. This is the same
  outlined/display-lettering detection gap recorded in the backlog for the Tsuki heading - **not** a translation defect.
- Japanese page furniture (the `第2&4木曜日更新` corner note, vertical margin text) is correctly left untouched by the
  source-language filter (`--source ENG`).

## What this says about the loop

The translation/guard stack generalises cleanly to an unseen series (gate 0, natural Thai). The remaining gaps are
render-side (container spill for free-standing text) and detector-side (outlined art lettering), both outside the
translation loop's ownership - the spill belongs to the render reconciliation work (#642) and the lettering gap needs a
detector campaign.
## Second unseen series (Bocchi the Rock!, 4 pages)

- **4/4 pages render telemetry clean** (`spill=0 overlap=0`); wall 13.7-24.8 s.
- **3 gate findings, all legitimate Latin proper names**: the artist `KLIMTS NIGHT` / `TIKTOK` are kept in Latin in the
  Thai answer (`ศิลปินดังอย่าง KLIMTS NIGHT จะมาร่วมด้วย!`, `เพลง KLIMTS กำลังฮิตบน TIKTOK...`). The `untranslated_word`
  guard fired and retried twice on that page (translation 10.9 s) yet shipped the same names both times.
- One `foreign_script` glitch (a Chinese `在日本` fragment inside a translator's-note line) was retried and cleaned.

### Candidate improvement (measured, not implemented)

In both observed cases where an untranslated Latin token survived retries (Bocchi's `KLIMTS NIGHT`, and the earlier
`ATERIAL` leak), the retry never improved the outcome: the same token (or a worse variant) came back. A per-class rule
"stop retrying `untranslated_word` when the identical Latin token survives the first retry" would save one gateway call
on name/brand lines with no measured quality loss, but it needs the retry loop to remember tokens per class - a
custom_openai change with its own tests, so it is queued rather than patched at the end of this loop.