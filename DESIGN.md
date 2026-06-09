---
name: MangaDock Visual System
description: A premium, multi-contextual design system bridging cinematic content with tactical precision.
colors:
  background: "#08090d"
  surface: "#1a1a1a"
  primary: "#6366f1"
  primary-glow: "rgba(99, 102, 241, 0.2)"
  secondary: "#f59e0b"
  secondary-glow: "rgba(245, 158, 11, 0.2)"
  foreground: "#f8f9fb"
  foreground-muted: "rgba(248, 249, 251, 0.4)"
  border: "rgba(255, 255, 255, 0.1)"
typography:
  display:
    fontFamily: "var(--font-noto-sans-thai), sans-serif"
    fontWeight: 900
    letterSpacing: "-0.02em"
    lineHeight: 1.1
  body:
    fontFamily: "var(--font-noto-sans-thai), sans-serif"
    fontWeight: 400
    fontSize: "14px"
    lineHeight: 1.6
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  card-monolith:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
---

<!-- lang:en -->
# Design System: MangaDock

## 1. Overview

**Creative North Star: "The Contextual Triad"**

MangaDock utilizes a layered aesthetic philosophy that adapts to the user's current task. It shifts between three distinct modes:
- **The Cinematic Canvas:** During manga reading, the UI recedes into the background. Depth is minimized, and controls are transparent or hidden to let the content dominate.
- **The Polished Monolith:** For general interaction and discovery (Home, Feed, Studio), the UI uses "Liquid Glass" surfaces—dark, polished stone-like containers with backdrop blurs and subtle 1px borders that convey physical substance and premium craft.
- **The Tactical Terminal:** For system status, wallet transactions, and high-precision tools, the UI adopts a high-density, status-driven look using glow effects and strict grid alignments.

**Key Characteristics:**
- **Zero AI Slop:** No generic gradients or unearned emojis. Every pixel is intentional.
- **Atmospheric Depth:** Layers are defined by opacity (`white/5`) and blur (`backdrop-blur-md`) rather than heavy drop shadows.
- **Native Fluidity:** Interactions are designed to feel like native OS components.

## 2. Colors

The palette is rooted in deep space neutrals tinted with purposeful accents.

### Primary
- **Indigo Action** (#6366f1): Used for primary calls-to-action, platform-wide navigation, and Translator-related states. It represents the "engine" of the platform.

### Secondary
- **Amber Manga** (#f59e0b): Used for manga-specific metadata (ranks, tags) and Creator-related states. It represents the "heart" and "value" of the content.

### Neutral
- **Deep Space** (#08090d): The base background. Always darker than sRGB black-grey to provide extreme contrast for manga content.
- **Monolith Surface** (#1a1a1a): Used for cards and secondary containers.

### Named Rules
**The Tint-Over-Solid Rule.** Surfaces should rarely be solid colors. Prefer `bg-white/5` over a fixed hex when layering to allow the background depth to bleed through.

## 3. Typography

The system uses Noto Sans Thai as a unified, high-performance font stack.

### Hierarchy
- **Display** (900 weight, dynamic clamp, 1.1 line-height): Used for cinematic headings and hero sections.
- **Headline** (800 weight, 24-30px): Used for major page sections (e.g., "คอมมูนิตี้").
- **Body** (400-500 weight, 14px, 1.6 line-height): Standard reading text. Max line length capped at 75ch for comfort.
- **Label** (900 weight, 10-12px, 0.25em tracking, UPPERCASE): Used for tactical indicators and section headers.

## 4. Elevation

Depth is conveyed through **Physical Transparency** and **Ambient Glow**.

### Shadow Vocabulary
- **Tactical Glow** (`shadow-[0_0_8px_var(--glow-color)]`): Used for icons and status lights in Terminal mode.
- **Monolith Lift** (`shadow-2xl shadow-black/40`): Used for floating Modals and high-priority Cards to separate them from the base canvas.

## 5. Components

### Buttons
- **Shape:** Soft tactical (12px radius).
- **Primary:** Indigo base with a 0.18s smooth transition. Active state scale down to 95%.
- **Liquid Glass:** `bg-white/5` with `backdrop-blur-md`. Used for secondary actions.

### Cards / Containers
- **Monolith Card:** `#1a1a1a` background, 1px border `white/10`, 16px-24px radius.
- **Compact Strip:** Reduced padding (12px), horizontal flow, minimal metadata.

### Navigation
- **Top Bar:** Fixed height (64px), high-blur backdrop, z-index 50.
- **Mobile Menu:** Right-aligned slide-over drawer with tactical navigation links.

## 6. Brand Identity

### Brand Personality
- **Sophisticated & Precise:** Like Apple, every gap and alignment is intentional.
- **Immersive & Cinematic:** Like Netflix, the UI recedes to let the content shine.
- **Tech-Forward:** Confident, high-performance, and reliable.

### Anti-references
- **Legacy Forums:** Avoid cluttered, dense, and "old-web" board designs.
- **Childish Palettes:** No oversaturated, "toy-like" colors.
- **AI Slop:** NO excessive emojis, generic gradients, or unpolished "generated" feels.
- **Friction:** No complex workflows or deep nesting.

### Core Design Principles
- **Native-First Fluidity:** Every interaction must feel purpose-built and as smooth as a native OS app.
- **High-Fidelity Minimalism:** Precision over decoration. Use "Liquid Glass" and blur for depth, not complexity.
- **Content as the Hero:** The UI provides the frame; the manga and the community provide the life.
- **Zero-Latency Feedback:** Instant responses (Optimistic UI) and clear, elegant loading states.

### Accessibility
- WCAG 2.1 Level AA.
- Support for high-contrast reading and reduced motion preferences.
- Inclusive typography optimized for multi-language manga text.

---

## 7. Do's and Don'ts

### Do:
- **Do** use `backdrop-blur-md` on all floating surfaces.
- **Do** use `.smooth-hover` (0.18s) for all transition-ready elements.
- **Do** use `Math.floor` for all financial revenue split calculations to favor creators.

### Don't:
- **Don't** use emojis for primary navigation or status. Use high-fidelity SVGs. (Anti-reference: "AI Slop").
- **Don't** use border-left/right stripes as accents. (Design Law: Absolute Ban).
- **Don't** use bright, "childish" primary colors. Stay within the sophisticated indigo/amber range.
<!-- lang:end -->

<!-- lang:th -->
# ระบบออกแบบ: MangaDock

## 1. ภาพรวม

**Creative North Star: "The Contextual Triad"**

MangaDock ใช้ปรัชญาด้านสุนทรียศาสตร์แบบหลายชั้นที่ปรับตัวตามงานของผู้ใช้ ระบบสลับระหว่าง 3 โหมด:
- **The Cinematic Canvas:** ระหว่างอ่านมังงะ UI จะถอยหลังไปอยู่เบื้องหลัง ลด depth ให้น้อยที่สุด ปุ่มควบคุมโปร่งใสหรือซ่อนไว้ให้เนื้อหาครองพื้นที่
- **The Polished Monolith:** สำหรับการใช้งานทั่วไปและค้นหา (Home, Feed, Studio) UI ใช้พื้นผิว "Liquid Glass" — คอนเทนเนอร์สีเข้มคล้ายหินขัดเงา มี backdrop blur และขอบ 1px ที่ส่อถึงวัสดุจริงและงานฝีมือพรีเมียม
- **The Tactical Terminal:** สำหรับสถานะระบบ ธุรกรรม wallet และเครื่องมือแม่นยำสูง UI ใช้รูปแบบ high-density ขับเคลื่อนด้วยสถานะ ใช้ glow effects และ grid alignment ที่เข้มงวด

**ลักษณะสำคัญ:**
- **Zero AI Slop:** ไม่มี gradient ทั่วไปหรือ emoji ที่ไม่มีความหมาย ทุก pixel มีเจตนา
- **Atmospheric Depth:** ชั้นต่างๆ กำหนดโดย opacity (`white/5`) และ blur (`backdrop-blur-md`) ไม่ใช่ drop shadow หนักๆ
- **Native Fluidity:** Interaction ออกแบบให้รู้สึกเหมือน component ของ OS จริง

## 2. สี

จานสีมีรากฐานจากสีกลางโทน deep space ที่เติมสีน้ำหนักเจาะจง

### Primary
- **Indigo Action** (#6366f1): ใช้สำหรับ call-to-action หลัก, navigation ทั่วแพลตฟอร์ม, และสถานะ Translator แทน "เครื่องยนต์" ของแพลตฟอร์ม

### Secondary
- **Amber Manga** (#f59e0b): ใช้สำหรับ metadata เฉพาะมังงะ (อันดับ, แท็ก) และสถานะ Creator แทน "หัวใจ" และ "คุณค่า" ของเนื้อหา

### Neutral
- **Deep Space** (#08090d): พื้นหลังหลัก เข้มกว่า sRGB black-grey เสมอเพื่อให้มีคอนทราสต์สูงสุดกับเนื้อหามังงะ
- **Monolith Surface** (#1a1a1a): ใช้สำหรับ card และ secondary container

### กฎที่ตั้งชื่อไว้
**กฎ Tint-Over-Solid:** พื้นผิวควรเป็นสีทึบน้อยมาก ใช้ `bg-white/5` แทนค่า hex ตายตัวเมื่อซ้อนชั้น เพื่อให้ความลึกของพื้นหลังส่องผ่านได้

## 3. ตัวอักษร

ระบบใช้ Noto Sans Thai เป็น font stack เดียวที่มีประสิทธิภาพสูง

### ลำดับชั้น
- **Display** (น้ำหนัก 900, clamp แบบ dynamic, line-height 1.1): ใช้สำหรับ heading แบบภาพยนตร์และ hero section
- **Headline** (น้ำหนัก 800, 24-30px): ใช้สำหรับ section หลักของหน้า
- **Body** (น้ำหนัก 400-500, 14px, line-height 1.6): ข้อความสำหรับอ่านปกติ ความยาวบรรทัดสูงสุด 75ch
- **Label** (น้ำหนัก 900, 10-12px, tracking 0.25em, UPPERCASE): ใช้สำหรับตัวบ่งชี้ tactical และ section header

## 4. ความลึก

ความลึกสื่อผ่าน **Physical Transparency** และ **Ambient Glow**

### คำศัพท์เงา
- **Tactical Glow** (`shadow-[0_0_8px_var(--glow-color)]`): ใช้สำหรับไอคอนและไฟสถานะในโหมด Terminal
- **Monolith Lift** (`shadow-2xl shadow-black/40`): ใช้สำหรับ Modal ลอยและ Card ลำดับสูงเพื่อแยกออกจาก canvas หลัก

## 5. Component

### ปุ่ม
- **รูปร่าง:** Soft tactical (12px radius)
- **Primary:** ฐาน Indigo พร้อม transition 0.18s scale ลง 95% เมื่อ active
- **Liquid Glass:** `bg-white/5` กับ `backdrop-blur-md` ใช้สำหรับ action รอง

### Card / Container
- **Monolith Card:** พื้นหลัง `#1a1a1a`, ขอบ 1px `white/10`, radius 16-24px
- **Compact Strip:** padding น้อยลง (12px), flow แนวนอน, metadata น้อยที่สุด

### Navigation
- **Top Bar:** ความสูงคงที่ (64px), backdrop blur สูง, z-index 50
- **Mobile Menu:** drawer เลื่อนจากขวา พร้อม navigation link แบบ tactical

## 6. อัตลักษณ์แบรนด์

### บุคลิกแบรนด์
- **มีระดับและแม่นยำ:** เหมือน Apple ทุกช่องว่างและการจัดวางมีเจตนา
- **สมจริงและภาพยนตร์:** เหมือน Netflix UI ถอยให้เนื้อหาส่องแสง
- **Tech-Forward:** มั่นใจ high-performance และน่าเชื่อถือ

### Anti-references
- **Legacy Forums:** หลีกเลี่ยงการออกแบบที่รกและแน่นแบบ "เว็บเก่า"
- **จานสีเด็ก:** ไม่มีสีสดใสเกินจริงแบบ "ของเล่น"
- **AI Slop:** ห้าม emoji มากเกิน, gradient ทั่วไป หรือ feel "ที่สร้างโดย AI"
- **Friction:** ไม่มี workflow ซับซ้อนหรือ nesting ลึก

### หลักการออกแบบหลัก
- **Native-First Fluidity:** ทุก interaction ต้องรู้สึกว่าสร้างมาเพื่อวัตถุประสงค์นั้นโดยเฉพาะ
- **High-Fidelity Minimalism:** ความแม่นยำเหนือการตกแต่ง ใช้ "Liquid Glass" และ blur สำหรับความลึก
- **Content as the Hero:** UI ให้กรอบ; มังงะและชุมชนให้ชีวิต
- **Zero-Latency Feedback:** การตอบสนองทันที (Optimistic UI) และสถานะ loading ที่ชัดเจนสวยงาม

### การเข้าถึง
- WCAG 2.1 Level AA
- รองรับการอ่านคอนทราสต์สูงและ reduced motion
- ตัวอักษรแบบ inclusive ที่ปรับแต่งสำหรับข้อความมังงะหลายภาษา

---

## 7. สิ่งที่ควรทำและไม่ควรทำ

### ควรทำ:
- **ควรทำ:** ใช้ `backdrop-blur-md` บนพื้นผิวลอยทั้งหมด
- **ควรทำ:** ใช้ `.smooth-hover` (0.18s) กับทุก element ที่รองรับ transition
- **ควรทำ:** ใช้ `Math.floor` ในการคำนวณ revenue split ทั้งหมดเพื่อเอื้อ creator

### ไม่ควรทำ:
- **ไม่ควรทำ:** ใช้ emoji สำหรับ navigation หรือสถานะหลัก ใช้ SVG ความละเอียดสูงแทน
- **ไม่ควรทำ:** ใช้ border-left/right เป็น accent สี (Design Law: Absolute Ban)
- **ไม่ควรทำ:** ใช้สีหลักที่สว่างหรือดูเหมือน "ของเล่น" ยึดอยู่ในช่วง indigo/amber ที่มีระดับ
<!-- lang:end -->
