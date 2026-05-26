# Plan: MangaDock Marketplace & Community Hub

## สถานะปัจจุบัน (ฐานเดิม)
- Auth: Firebase (Google/Facebook/Email) และ `AuthGuard` แบบ login only
- User profile: Firestore `users/{uid}` มีข้อมูลพื้นฐาน
- Favorites/reading history/liked: ใช้งานได้แล้ว
- MIT translation: ใช้งานได้และมี cache infrastructure
- Redis cache: มี `CacheOrchestratorService`
- ยังไม่มี: wallet, creator economy, revenue share, unlock economy, role translator/creator, moderation/legal workflow, ranking/trust score, upload pipeline, payout

## วิสัยทัศน์ Business Model (ฉบับอัปเดต)
- MangaDex content = traffic acquisition และ free reading (ไม่ monetize ตรง)
- รายได้หลัก = creator/translator marketplace + coin unlock + premium subscription + tools service
- Premium = ใช้แปล MIT ไม่จำกัด + ส่วนลดปลดล็อคตอน creator
- เปิด translator upload ตั้งแต่แรก เพื่อตอกภาพว่าเป็น community platform ไม่ใช่ AI-only
- เมื่อมี human translation แล้ว ให้ human translation เป็น default priority; MIT เป็น fallback
- รองรับหลายเวอร์ชันในภาษาเดียวกัน (ไม่ผูกขาด) และให้ user เลือกจากคะแนนคุณภาพ
- วางระบบ legal-safe: report, takedown, region blocking, ToS และ rights handling

## Product Principles
- Human-first quality: ถ้ามีงานแปลคน ให้แสดงก่อน MIT
- Marketplace-first growth: เปิดให้ตั้งราคา + แข่งขันคุณภาพ
- Cache-first efficiency: reuse cache ให้มากที่สุดเพื่อลดต้นทุนต่อผู้ใช้
- Compliance-by-design: แยกแหล่ง content และ policy ชัดเจน
- Web-first execution: โฟกัส Web App/PWA ก่อน Mobile Native

---

## Phase 0: Foundation & Data Model Migration (ต้องทำก่อน)

### 0.1 User/Role/Plan Schema
- ขยาย `users/{uid}`:
  - `role: 'user' | 'translator' | 'creator' | 'admin'`
  - `plan: 'free' | 'premium' | 'pro'`
  - `trustScore`, `ratingAvg`, `ratingCount`
  - `country`, `preferredLanguage`
- เพิ่ม endpoint `GET /users/me` ให้คืน role/plan/trust/profile ครบ

### 0.2 Content Origin Segmentation
- แยก origin ชัดเจนระดับ chapter/version:
  - `origin: 'mangadex' | 'platform_original' | 'indie_creator' | 'translator_upload'`
- policy engine ต้องรู้ว่า content ไหน monetize ได้/ไม่ได้

### 0.3 Versioning Model (แกนของระบบหลายงานแปล)
- เพิ่ม collection:
  - `titles/{titleId}`
  - `chapters/{chapterId}`
  - `chapterVersions/{versionId}` (ต่อภาษา ต่อผู้แปล)
- field สำคัญของ `chapterVersions`:
  - `language`, `translatorUid`, `priceCoins`, `status`, `qualityScore`, `isDefault`

---

## Phase 1: Translator Upload + Unlock Economy (เปิดตลาดตั้งแต่วันแรก)

### 1.1 Upload Pipeline (Backend + Frontend)
- สร้างระบบอัปโหลด chapter version โดย translator/creator
- ตรวจสอบ duplicate + conflict (กำลังแปลอยู่หรือไม่)
- รองรับ draft/publish/moderation states

### 1.2 Wallet / Coin / Unlock
- สร้าง wallet ledger:
  - `wallets/{uid}`: balance
  - `walletTransactions/{txId}`: topup/spend/refund/revenue-share
  - `unlocks/{uid}/{chapterVersionId}`
- unlock ต้องเป็น idempotent และรองรับ retry

### 1.3 Revenue Share
- แบ่งรายได้อัตโนมัติ:
  - Translator/Creator share
  - Platform fee
  - กำหนด rate พิเศษสำหรับ `platform_original` และ `indie_creator`
- เพิ่ม statement API ให้ creator ดูรายรับรายวัน

### 1.4 Donation (ไม่หักเปอร์เซ็นต์)
- เพิ่ม direct donate flow เข้ากระเป๋า creator/translator โดยไม่เก็บ fee
- แยก ledger ประเภท donation ชัดเจน

---

## Phase 2: Premium/Pro Subscription + MIT Fallback Strategy

### 2.1 Premium Entitlements
- Premium: MIT unlimited + discount unlock
- Pro: entitlement สำหรับ tool usage สูงกว่า premium
- entitlement check อยู่กลางที่ guard/service เดียว

### 2.2 MIT Priority Rules
- ลำดับแสดงผล chapter:
  1) Human translation ภาษาผู้ใช้
  2) Human translation ภาษาอื่น + MIT on-demand
  3) MIT fallback จาก source ที่อนุญาต
- ถ้า source ไม่มี data ใหม่ แต่ translator upload มี ให้แสดง translator version ได้ทันที

### 2.3 Dynamic Discount Engine
- ส่วนลด unlock ของ premium/pro ต่อ chapter version
- รองรับ campaign/seasonal promo

---

## Phase 3: Payments, Payouts, and Regional Billing

### 3.1 Payment Gateways
- ระยะแรก: QR Code Payment (ในประเทศ)
- ระยะถัดไป: card/international wallet ผ่าน gateway (เช่น PayPal/Stripe/อื่นๆ)
- webhook verification + reconciliation ทุกธุรกรรม

### 3.2 Payout to Translator/Creator
- payout queue + status tracking
- anti-fraud checks ก่อนปล่อยเงิน
- exporter รายงานการเงินสำหรับบัญชี

### 3.3 Accounting Integrity
- double-entry style ledger
- immutable transaction log
- daily settlement job

---

## Phase 4: Ranking, Trust, Quality, and Discovery

### 4.1 Rating/Comment/Review
- user rate chapter version ได้
- comment moderation และ anti-spam

### 4.2 Trust Score + Quality Algorithm
- คำนวณ trust score จาก rating consistency, report rate, completion quality
- ลดการปั่นงานเร็วคุณภาพต่ำด้วย quality gate

### 4.3 Charts, Bonus, and Recommendation
- Top 10 Translator / Top 10 Creator พร้อมโบนัส
- recommendation engine: แนะนำ translator/creator ที่แนวคล้ายกัน
- รองรับ multi-version ranking ในภาษาเดียวกัน

### 4.4 Community Notes
- ผู้ใช้ trust สูงช่วย annotate/verify คุณภาพงานแปล
- ใช้เป็น signal ให้ algorithm โดยไม่แทนที่ moderation

---

## Phase 5: Legal, Moderation, and Regional Compliance

### 5.1 Rights & Region Blocking
- blocked titles by region เมื่อมี LC
- policy engine บังคับตามประเทศผู้ใช้

### 5.2 Report/Takedown Workflow
- report center + SLA
- audit trail ทุกการตัดสินใจ (legal defensibility)

### 5.3 Source Policy Enforcement
- ห้าม monetize content จาก source ที่ policy ไม่อนุญาต
- UI แสดงป้าย source/provenance ชัดเจนทุก chapter/version

---

## Phase 6: Creator Tools (Text Removal + Editor)

### 6.1 Text Removal Service
- บริการลบข้อความแบบคิดราคาเป็น workload (bounding box area/complexity)
- price estimate ก่อนยืนยัน
- premium/pro มีโควตาฟรีรายเดือนตาม entitlement

### 6.2 Web Editor (Phase ถัดไป)
- editor บนเว็บสำหรับใส่ text หลัง clean
- template font/style/layer
- export + publish เข้า chapter version pipeline ตรง

---

## Phase 7: Community Retention (Forum + Ecosystem)

### 7.1 Forum/Discussion
- **PRD:** [PRD_COMMUNITY_FORUM.md](./PRD_COMMUNITY_FORUM.md)
- กระดานคุยระดับ title/chapter/version
- sticky posts สำหรับ translator notes/changelog

### 7.2 Long-session Features
- follow translator/creator
- event/seasonal challenges
- collection/list sharing

---

## Backend Modules

### ✅ Implemented
- `Backend/src/forum/` (threads, comments, image upload, voting)
- `Backend/src/wallet/` (wallet balance, ledger)
- `Backend/src/unlock/` (unlock economy, idempotent unlock flow)
- `Backend/src/upload/` (StorageModule — DiskStorageProvider, injectable via `STORAGE_PROVIDER`)
- `Backend/src/versions/` (chapter versions)

### 🔭 Roadmap
- `Backend/src/creator-economy/` (pricing, revenue share, payouts)
- `Backend/src/content-origin/` (origin policy)
- `Backend/src/entitlements/` (plan/benefit resolver)
- `Backend/src/payments/` (topup, webhook, reconciliation)
- `Backend/src/payouts/` (withdrawal pipeline)
- `Backend/src/recommendation/` (discovery signals)
- `Backend/src/ranking/` (charts/bonus)
- `Backend/src/trust/` (trust score + anti-abuse)
- `Backend/src/legal/` (report, takedown, region block)
- `Backend/src/text-removal/` (estimate + consume credits)

## Frontend Areas

### ✅ Implemented
- `Frontend/app/studio/` (translator/creator upload studio — works, manga, wallet, upload pages)
- `Frontend/app/community/` (community forum — posts, comments, voting, image upload)

### 🔭 Roadmap
- `Frontend/app/wallet/` (dedicated balance, topup, history page)
- `Frontend/app/creator/` และ `Frontend/app/translator/` profile pages
- `Frontend/app/chapter/[id]/versions` (เลือกเวอร์ชันแปล)
- `Frontend/app/premium/` (subscription & benefits)
- `Frontend/app/admin/` (moderation/legal/finance dashboards)
- `Frontend/app/tools/text-removal/` (estimate + run)

## ไฟล์สำคัญที่ต้องแก้ (จากฐานเดิม)
- `Backend/src/users/users.service.ts` (role/plan/trust fields)
- `Backend/src/auth/auth.guard.ts` (attach role/plan/entitlement context)
- `Backend/src/books/books.controller.ts` (MIT fallback policy + unlock check)
- `Backend/src/books/books.service.ts` (content source policy + version priority)
- `Backend/src/app.module.ts` (import modules ใหม่)
- `Frontend/app/contexts/AuthContext.tsx` (role/plan/entitlement)
- `Frontend/app/components/AccountModal.tsx` (plan, wallet, creator tools, payout)
- `Frontend/app/components/MangaReader.tsx` (version selector + unlock state + source label)

## Supabase Tables (Current + Target)

### ✅ Current (Implemented)
- `profiles`
- `wallets`
- `wallet_transactions`
- `chapter_versions`
- `unlocks`
- `forum_posts` (รองรับ `image_urls TEXT[]`)
- `forum_comments` (รองรับ `parent_id` self-referential FK สำหรับ nested threads)
- `forum_votes`

### 🔭 Target (Roadmap)
- `subscriptions`
- `reports`
- `region_policies`
- `ratings`
- `trust_events`
- `leaderboards`
- `bonus_payouts`

## Dependencies (ลำดับการทำงาน)
- Phase 0 ต้องมาก่อนทุกเฟส
- Phase 1 ก่อน Phase 2 และ Phase 3
- Phase 2 ก่อนการโปรโมต premium scale
- Phase 3 ก่อน payout production
- Phase 4 และ 5 ทำขนานกันได้หลัง Phase 1
- Phase 6 เริ่มได้หลัง wallet + entitlements พร้อม
- Phase 7 เริ่มหลัง trust/moderation pipeline พร้อมขั้นต่ำ

## KPI ที่ต้องติดตาม
- % chapter reads from cache
- wallet conversion rate
- unlock-to-repeat-purchase rate
- premium conversion และ churn
- average creator earnings / month
- report resolution time
- trust-adjusted quality score per language

## Decisions (ฉบับอัปเดต)
- โฟกัส Web App/PWA เป็นหลัก ไม่แตก native app ในช่วงแรก
- MangaDex-origin ใช้เป็น traffic/fallback และต้อง enforce policy ไม่ monetize ตรง
- Human translation เป็นสินค้าหลักของ marketplace; MIT เป็น accelerant/fallback
- รองรับหลายเวอร์ชันในภาษาเดียวกันเพื่อการแข่งขันคุณภาพ
- วาง legal + moderation เป็น first-class system ไม่ใช่งานเสริม
