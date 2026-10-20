---
name: MangaDock Visual System
description: The Strata design language applied to a manga reading app — Modern Swiss, Editorial Minimalism, Apple-like calm; minimal but never boring because each area carries its own visual.
colors:
  light:
    bg: "#f5f5f7"
    surface: "#ffffff"
    ink: "#131316"
    accent: "#0a62d6"
    ok: "#1a8a4a"
    danger: "#c8322f"
  dark:
    bg: "#0b0b0d"
    surface: "#151518"
    ink: "#f1f1f3"
    accent: "#5aa2ff"
    ok: "#4cc380"
    danger: "#ff6b6b"
  derived:
    ink-2: "color-mix(in srgb, var(--ink) 66%, var(--bg))"
    ink-3: "color-mix(in srgb, var(--ink) 42%, var(--bg))"
    line: "color-mix(in srgb, var(--ink) 12%, transparent)"
    fill: "color-mix(in srgb, var(--ink) 6%, transparent)"
    raised: "color-mix(in srgb, var(--ink) 4%, var(--surface))"
typography:
  sans: "Inter, Anuphan (Thai), system-ui"
  mono: "JetBrains Mono — labels, numbers, badges"
  serif: "Instrument Serif — at most one statement word per page"
  display:
    size: "clamp(2.3rem, 4.1vw, 3.9rem)"
    weight: 600
    letterSpacing: "0 by default; -0.035em only on a Latin-only heading"
    lineHeight: "1.2 (Thai-first app)"
  body:
    size: "1.0625rem"
    lineHeight: "1.6 (Latin) / 1.75 (Thai)"
rounded:
  r1: "8px"
  r2: "12px"
  r3: "16px"
  card: "28px"
  pill: "999px"
motion:
  ease: "cubic-bezier(0.23, 1, 0.32, 1)"
  durations: "160ms / 320ms / 600ms"
  stagger: "38ms"
  glide: "420ms cubic-bezier(0.4, 0, 0.2, 1)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    height: "44px"
  pill-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.surface}"
    border: "1px {colors.line}"
    rounded: "{rounded.card}"
---

<!-- lang:en -->
# Design System: MangaDock

This file is the source of truth for the design language; the token values are implemented in `Frontend/app/globals.css` (keep the two in step) and the components in `Frontend/app/components/ui/`. The language is ported from the Strata site — read `D:\Github\Strata-xeno-System-Design\ROUTER.md` for its reasoning, and `docs/superpowers/specs/2026-10-20-frontend-redesign-strata-design.md` for how MangaDock adopts it.

## 1. Overview

**North star: "Minimal, never boring."** A calm, editorial surface — monochrome hierarchy, wide whitespace, flush-left text, hairline dividers — so the manga covers and pages are the colour. Each feature area adds one visual that belongs to it (a mascot, a staged progress, a dot field), never decoration for its own sake. MangaDock is an app, not a landing page.

## 2. Colors

- **Base:** `bg`, `surface`, `ink`; everything else is derived from `ink` with `color-mix` (`ink-2` secondary text, `ink-3` tertiary, `line` borders, `fill` tints, `raised` a lifted surface).
- **Accent:** one hue only — blue (`#0a62d6` light / `#5aa2ff` dark) for focus, selection, status and a rare highlight.
- **Status:** `ok` and `danger`, always with an icon or a label, never colour alone. `coin` is the gold of coins, wallet and prices — a currency meaning, used nowhere else.
- **Themes:** System / Light / Dark through `data-theme` on `<html>`; **default dark**. Always-dark islands (the reader) use `.theme-dark`, which re-declares the derived tokens.

### Named rules
- **No purple, anywhere** — no indigo, violet or fuchsia, no purple gradients, no purple glow.
- **Plain backgrounds** — page background is `bg`, flat; no gradient blobs, no full-page glass, no neon.
- **No literal hex in components** — use the Tailwind token colours (`bg-surface`, `text-ink-2`, `border-line`, `bg-fill`, `text-accent`).

## 3. Typography

Inter for Latin, Anuphan for Thai glyphs (same stack, falls through per glyph), JetBrains Mono for labels and numbers (`tabular-nums`), Instrument Serif for at most one statement word per page. Headings weight 600, `text-wrap: balance`, no tracking by default (a Latin-only heading may add `-0.035em`). **Thai text never gets letter-spacing** — it breaks Thai clusters. Type scale: `text-display`, `text-h2`, `text-h3`, `text-lede` (Tailwind tokens, Strata sizes, Thai line-heights 1.2–1.25). Spacing uses Tailwind's 4 px scale in steps of 8 px. Page titles use `GradientHeading` (neutral grey-to-grey only).

## 4. Elevation

Almost flat. Depth comes from a 1 px `line` border and the `raised` surface, not shadows. Shadows only for floating layers: menus `0 18px 40px -16px rgb(0 0 0 / .3)`, windows `0 50px 90px -50px rgb(0 0 0 / .45)`.

## 5. Components

- **Button** (`ui/Button`): 44 px pill; `primary` = ink fill with bg text (hover mixes 12 % accent), `secondary` = surface + line, `ghost` = transparent. Press moves 1 px down; `arrow` adds the sliding →. A button that keeps its own size uses `PRIMARY_FILL` instead of copying the classes.
- **StatusPage** (`ui/StatusPage`): the shell for 404 / error screens.
- **Pill** (`ui/Pill`): one component for chips, filters and tabs; selected = ink fill.
- **Badge** (`ui/Badge`): mono 11 px pill, tone tints the border.
- **Input** (`ui/Input`): 48 px pill on surface.
- **Card** (`ui/Card`): 1 px line, 28 px radius, hover raises the border.
- **Disclosure** (`ui/Disclosure`): native `<details>` row with a +/− circle.
- **Loader** (`ui/Loader`, loading-dev): page/section = Atom, inline = Arc, MIT translation = Slide. Never a hand-made `animate-spin` ring.
- **Reveal** (`ui/Reveal`): content visible by default; under `html.js` it rises in once, staggered.

## 6. Motion

One easing `cubic-bezier(0.23, 1, 0.32, 1)`, durations 160 / 320 / 600 ms, 38 ms stagger, 420 ms glide for growing boxes. No scroll hijacking. Everything turns off under `prefers-reduced-motion`. Heavy visuals (canvas, 3-D) load when near, run only when seen, release on unmount, and always have a static fallback.

## 7. Do's and Don'ts

### Do
- Start from the final, readable state; add motion as a layer.
- Check 390 / 1024 / 1440 px every time; `scrollWidth` must equal `clientWidth`.
- Give every wait, empty and error state a designed visual.

### Don't
- Use purple, gradients behind content, glass panels or glow.
- Put spaces inside animated inline-blocks (the words run together).
- Copy a spinner or a button style instead of using `components/ui`.

## 8. Migration table (old classes → tokens)

Used when an area is moved onto the tokens (Epic B). Pick by meaning, not by the old shade.

| Old | New |
|---|---|
| page `bg-[#0a0a0a]`, `bg-[#08090d]`, `bg-black` | `bg-bg` |
| panel `bg-[#141414]`, `bg-[#151518]`, `bg-[#181818]`, `bg-[#1a1a1a]`, `bg-[#1c1c1c]`, `bg-[#202020]` | `bg-surface` (a panel on a panel: `bg-raised`) |
| `bg-white/[0.02]`–`bg-white/10` tints, hovers | `bg-fill` (hover on a fill: `bg-raised`) |
| `text-white`, `text-white/80`–`/90` | `text-ink` |
| `text-white/50`–`/70` | `text-ink-2` |
| `text-white/20`–`/45`, placeholders | `text-ink-3` |
| `border-white/5`–`/15` | `border-line`; `border-white/20`–`/30` → `border-ink-3` |
| `bg-white text-black` (selected chip / primary) | `bg-ink text-bg` (`Pill selected`, `Button primary`, `PRIMARY_FILL`) |
| amber / orange used as highlight, link, selected, active | `text-accent`, `bg-accent/10`, `border-accent/40` |
| amber / gold for coins, wallet, prices | `text-coin`, `bg-coin/10`, `border-coin/40` |
| red for errors, destructive | `text-danger`, `bg-danger/10`, `border-danger/40` |
| green for success | `text-ok`, `bg-ok/10`, `border-ok/40` |
| hand-made `animate-spin` ring or SVG spinner | `<Loader context="inline" / "section" / "page" />` |
| `tracking-widest`, `tracking-[0.1em+]` on Thai text | remove (mono Latin labels may keep `tracking-[0.1em]`) |
| glow `shadow-*-500/…`, `drop-shadow` glows, gradient blobs | remove |
<!-- lang:end -->

<!-- lang:th -->
# ระบบออกแบบ: MangaDock

ไฟล์นี้คือที่อ้างอิงหลักของภาษา design ส่วนค่าของ token เขียนไว้ใน `Frontend/app/globals.css` (ต้องแก้สองที่ให้ตรงกันเสมอ) และ component อยู่ใน `Frontend/app/components/ui/` ภาษา design นี้พอร์ตมาจากเว็บ Strata — อ่านเหตุผลได้ที่ `D:\Github\Strata-xeno-System-Design\ROUTER.md` และอ่านวิธีที่ MangaDock นำมาใช้ได้ที่ `docs/superpowers/specs/2026-10-20-frontend-redesign-strata-design.md`

## 1. ภาพรวม

**หลักนำทาง: "Minimal แต่ไม่น่าเบื่อ"** พื้นผิวสงบแบบงานบรรณาธิการ — ลำดับชั้นด้วยขาวดำ ที่ว่างกว้าง ข้อความชิดซ้าย เส้นคั่นบางเฉียบ — เพื่อให้ปกมังงะกับหน้ามังงะเป็นสีสันของหน้า แต่ละพื้นที่ของฟีเจอร์เพิ่ม visual หนึ่งอย่างที่เป็นของพื้นที่นั้น (mascot, progress แบบเป็นขั้น, ทุ่งจุด) ไม่ใช่ของตกแต่งเพื่อตกแต่ง MangaDock คือแอป ไม่ใช่ landing page

## 2. สี

- **สีหลัก:** `bg`, `surface`, `ink` ที่เหลือคำนวณต่อจาก `ink` ด้วย `color-mix` (`ink-2` ตัวหนังสือรอง, `ink-3` ตัวหนังสือระดับสาม, `line` เส้นขอบ, `fill` สีจางๆ, `raised` พื้นผิวที่ยกขึ้น)
- **Accent:** มีสีเดียวคือน้ำเงิน (`#0a62d6` สว่าง / `#5aa2ff` มืด) ใช้กับ focus, การเลือก, สถานะ และไฮไลต์นานๆ ครั้ง
- **สถานะ:** `ok` กับ `danger` ต้องมี icon หรือข้อความประกอบเสมอ ห้ามใช้สีอย่างเดียว ส่วน `coin` คือสีทองของเหรียญ wallet และราคา — เป็นความหมายของเงิน ห้ามใช้ที่อื่น
- **ธีม:** System / Light / Dark ผ่าน `data-theme` บน `<html>` **ค่าเริ่มต้นคือมืด** ส่วนที่มืดตลอด (reader) ใช้ `.theme-dark` ซึ่งประกาศ token ที่คำนวณต่อซ้ำอีกครั้ง

### กฎที่ตั้งชื่อไว้
- **ห้ามมีสีม่วงที่ไหนเลย** — ไม่มี indigo, violet หรือ fuchsia ไม่มี gradient สีม่วง ไม่มีแสงเรืองสีม่วง
- **พื้นหลังเรียบ** — พื้นหลังของหน้าคือ `bg` แบบเรียบ ไม่มี gradient blob ไม่มี glass เต็มหน้า ไม่มี neon
- **ห้ามใส่ hex ตรงๆ ใน component** — ให้ใช้สี token ของ Tailwind (`bg-surface`, `text-ink-2`, `border-line`, `bg-fill`, `text-accent`)

## 3. ตัวอักษร

Inter สำหรับตัวละติน, Anuphan สำหรับตัวอักษรไทย (อยู่ใน stack เดียวกัน ระบบเลือกฟอนต์ทีละตัวอักษร), JetBrains Mono สำหรับ label และตัวเลข (`tabular-nums`), Instrument Serif ใช้ได้มากสุดหนึ่งคำต่อหน้า หัวข้อหนา 600 ใช้ `text-wrap: balance` ค่าเริ่มต้นไม่มี tracking (หัวข้อที่เป็นตัวละตินล้วนใส่ `-0.035em` ได้) **ข้อความไทยห้ามปรับระยะตัวอักษร** เพราะจะทำให้กลุ่มตัวอักษรไทยแตก type scale: `text-display`, `text-h2`, `text-h3`, `text-lede` (token ของ Tailwind ใช้ขนาดของ Strata และ line-height แบบไทย 1.2–1.25) ระยะห่างใช้ scale 4 px ของ Tailwind โดยขยับทีละ 8 px หัวข้อหลักของหน้าใช้ `GradientHeading` (เฉพาะโทนเทาไล่เทาเท่านั้น)

## 4. ความลึก

เกือบแบน ความลึกมาจากเส้นขอบ `line` 1 px กับพื้นผิว `raised` ไม่ได้มาจากเงา เงาใช้เฉพาะชั้นที่ลอยอยู่: เมนู `0 18px 40px -16px rgb(0 0 0 / .3)`, หน้าต่าง `0 50px 90px -50px rgb(0 0 0 / .45)`

## 5. Component

- **Button** (`ui/Button`): pill สูง 44 px; `primary` = พื้น ink ตัวหนังสือสี bg (hover ผสม accent 12 %), `secondary` = surface + line, `ghost` = โปร่งใส กดแล้วเลื่อนลง 1 px ส่วน `arrow` เพิ่มลูกศร → ที่เลื่อนตอน hover ปุ่มที่ต้องคงขนาดของตัวเองให้ใช้ `PRIMARY_FILL` แทนการ copy class
- **StatusPage** (`ui/StatusPage`): โครงของหน้า 404 / error
- **Pill** (`ui/Pill`): component เดียวสำหรับ chip, ตัวกรอง และ tab เมื่อถูกเลือก = พื้น ink
- **Badge** (`ui/Badge`): pill ตัวอักษร mono 11 px สีของ tone แต้มที่เส้นขอบ
- **Input** (`ui/Input`): pill สูง 48 px บน surface
- **Card** (`ui/Card`): เส้นขอบ line 1 px, radius 28 px, hover แล้วเส้นขอบเข้มขึ้น
- **Disclosure** (`ui/Disclosure`): แถว `<details>` แบบ native มีวงกลม +/−
- **Loader** (`ui/Loader`, loading-dev): หน้า/ส่วนของหน้า = Atom, ในบรรทัด = Arc, รอ MIT แปล = Slide ห้ามทำวง `animate-spin` เอง
- **Reveal** (`ui/Reveal`): เนื้อหามองเห็นได้ตั้งแต่ต้น ภายใต้ `html.js` จะค่อยๆ ลอยขึ้นครั้งเดียวแบบเหลื่อมเวลา

## 6. Motion

easing ตัวเดียว `cubic-bezier(0.23, 1, 0.32, 1)` ความยาว 160 / 320 / 600 ms stagger 38 ms และ glide 420 ms สำหรับกล่องที่ขยายขนาด ห้าม scroll hijack ทุกอย่างปิดเมื่อ `prefers-reduced-motion` ส่วน visual หนักๆ (canvas, 3-D) โหลดเมื่อเลื่อนใกล้ ทำงานเฉพาะตอนมองเห็น ปล่อยทรัพยากรเมื่อ unmount และมี fallback แบบภาพนิ่งเสมอ

## 7. สิ่งที่ควรทำและไม่ควรทำ

### ควรทำ
- เริ่มจากสถานะสุดท้ายที่อ่านได้ แล้วค่อยเพิ่ม motion เป็นอีกชั้น
- เช็ก 390 / 1024 / 1440 px ทุกครั้ง `scrollWidth` ต้องเท่ากับ `clientWidth`
- ทุกช่วงที่ต้องรอ ทุก empty state และทุก error state ต้องมี visual ที่ออกแบบไว้

### ไม่ควรทำ
- ใช้สีม่วง, gradient หลังเนื้อหา, panel แบบ glass หรือแสงเรือง
- ใส่ช่องว่างไว้ใน inline-block ที่ animate (คำจะติดกัน)
- copy spinner หรือสไตล์ปุ่มมาใช้แทนการใช้ `components/ui`

## 8. ตารางแปลง (class เดิม → token)

ใช้ตอนย้ายแต่ละพื้นที่มาใช้ token (Epic B) ให้เลือกตามความหมาย ไม่ใช่ตามเฉดสีเดิม

| เดิม | ใหม่ |
|---|---|
| พื้นหลังหน้า `bg-[#0a0a0a]`, `bg-[#08090d]`, `bg-black` | `bg-bg` |
| panel `bg-[#141414]`, `bg-[#151518]`, `bg-[#181818]`, `bg-[#1a1a1a]`, `bg-[#1c1c1c]`, `bg-[#202020]` | `bg-surface` (panel ที่ซ้อนอยู่บน panel: `bg-raised`) |
| สีจางๆ และ hover แบบ `bg-white/[0.02]`–`bg-white/10` | `bg-fill` (hover บน fill: `bg-raised`) |
| `text-white`, `text-white/80`–`/90` | `text-ink` |
| `text-white/50`–`/70` | `text-ink-2` |
| `text-white/20`–`/45`, placeholder | `text-ink-3` |
| `border-white/5`–`/15` | `border-line`; `border-white/20`–`/30` → `border-ink-3` |
| `bg-white text-black` (chip ที่ถูกเลือก / ปุ่มหลัก) | `bg-ink text-bg` (`Pill selected`, `Button primary`, `PRIMARY_FILL`) |
| amber / orange ที่ใช้เป็นไฮไลต์ ลิงก์ ตัวที่ถูกเลือก หรือสถานะ active | `text-accent`, `bg-accent/10`, `border-accent/40` |
| amber / ทอง สำหรับเหรียญ wallet และราคา | `text-coin`, `bg-coin/10`, `border-coin/40` |
| สีแดงสำหรับ error และการกระทำที่ทำลายข้อมูล | `text-danger`, `bg-danger/10`, `border-danger/40` |
| สีเขียวสำหรับสำเร็จ | `text-ok`, `bg-ok/10`, `border-ok/40` |
| วง `animate-spin` หรือ spinner SVG ที่ทำเอง | `<Loader context="inline" / "section" / "page" />` |
| `tracking-widest`, `tracking-[0.1em+]` บนข้อความไทย | เอาออก (label ภาษาละตินแบบ mono ยังใช้ `tracking-[0.1em]` ได้) |
| แสงเรือง `shadow-*-500/…`, `drop-shadow` ที่เรืองแสง, gradient blob | เอาออก |
<!-- lang:end -->
