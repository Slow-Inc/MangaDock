# MangaDock — Feature Gaps & Ideas

> วิเคราะห์จาก Frontend codebase จริง (`Frontend/app/`) — 2026-07-21
>
> แยกระหว่าง "ไม่มีจริงๆ" กับ "มีแล้ว" เพื่อไม่ให้ implement ซ้ำ

---

## สิ่งที่มีแล้ว (อย่า implement ซ้ำ)

| Feature | หลักฐานใน codebase |
|---|---|
| Reading Progress / Continue Reading | `ContinueReadingRow.tsx` + `lib/readingHistory.ts` |
| Bookmarks / My List | `/mylist` page + `useBookActions.ts` |
| Manga Discussion (forum per series) | `/community/manga/[mangaId]` |
| Public User Profile | `/community/profile/[uid]` |
| Creator Studio | `/studio/**` ครบทุก tab |
| Chapter Unlock ด้วย Coin | `useChapterUnlock.ts` + `wallet/` |
| AI Translation + Model Toggle | `useChapterTranslation.ts` + `DevMangaTranslateModelToggle.tsx` |
| Zoom / Pan ใน Reader | `useZoomPan.ts` |
| 2FA + Settings เต็มรูปแบบ | `/settings/**` 5 tabs |
| Admin Dashboard + Audit Log | `/admin/**` 4 tabs |

---

## Feature ที่ยังขาด

### 🔴 High Impact — ควร build ก่อน

---

#### 1. Notification System

**ปัญหา:** ไม่มีระบบแจ้งเตือนใดๆ ในตอนนี้ — ไม่มี bell icon, notification panel, หรือ page

**ผลกระทบ:** User ต้องกลับมาเช็คเองว่ามีอะไรใหม่หรือเปล่า (chapter ใหม่, มีคนตอบกระทู้, มีคน mention)

**Components ที่ต้องสร้าง:**
- `NotificationBell.tsx` — badge + dropdown ใน Navbar
- `/notifications` page — ดู history ทั้งหมด
- `useNotifications.ts` hook — fetch + mark as read
- Backend: `notifications` table + SSE/polling endpoint

**ประเภทการแจ้งเตือนที่ควรมี:**
- Chapter ใหม่ของ series ที่ติดตาม
- มีคนตอบ comment ของเรา
- มีคน mention ในกระทู้
- บัญชีถูก login จาก device ใหม่ (security — backend ทำแล้ว แต่ frontend ไม่แสดง)

---

#### 2. Series Follow + Chapter Alert

**ปัญหา:** ไม่มีปุ่ม "ติดตาม series" และไม่มี mechanism แจ้งเมื่อ chapter ใหม่ออก

**ผลกระทบ:** User ต้องจำชื่อ manga แล้วกลับมาค้นหาเอง → retention ต่ำมาก

**Components ที่ต้องสร้าง:**
- `FollowSeriesButton.tsx` — ปุ่มใน `book/[id]` + `BookDetailModal.tsx`
- `/mylist` ควร tab แยก "กำลังติดตาม" vs "บันทึกแล้ว"
- Backend: `series_follows` table + job หรือ trigger เมื่อ chapter ใหม่ upload

**Note:** `/mylist` มีอยู่แล้ว แต่น่าจะเป็น bookmark ธรรมดา ไม่ใช่ subscription

---

#### 3. Rating & Review ต่อ Manga Series

**ปัญหา:** ไม่มีระบบให้คะแนน/รีวิว series เลย มีแค่ forum discussion ทั่วไป

**ผลกระทบ:** User ใหม่ไม่รู้ว่า manga ไหนดี, ไม่มี social proof, discovery อ่อนแอ

**Components ที่ต้องสร้าง:**
- `StarRating.tsx` — interactive 1-10 หรือ 1-5 ดาว
- `ReviewCard.tsx` — แสดง review พร้อม rating + text
- `ReviewSection.tsx` — ใส่ใน `/book/[id]` ด้านล่าง chapter list
- `/book/[id]/reviews` — หน้า reviews ทั้งหมด

**Database:**
```sql
manga_reviews (user_id, manga_id, rating INT, body TEXT, created_at)
```

---

### 🟡 Medium Impact — ค่อยๆ เพิ่ม

---

#### 4. Reader Inline Comments

**ปัญหา:** มี `/community/manga/[id]` สำหรับ discussion แต่ต้องออกจาก reader ไปดู, ไม่มี comment section ใน reader เอง

**ผลกระทบ:** คน discuss น้อยลง เพราะ friction สูง

**แนวทาง:**
- Drawer/panel ทางขวาใน `MangaReader.tsx` ที่ open ได้โดยไม่ออกจากหน้า
- Tab: "กระทู้ทั้งหมด" | "Chapter นี้เท่านั้น"
- Reuse `PostCard.tsx` + `CommentThread.tsx` ที่มีอยู่แล้ว

---

#### 5. Follow User + Social Feed

**ปัญหา:** `/community/profile/[uid]` มีอยู่แล้วแต่ไม่มีปุ่ม Follow และไม่มี feed ของคนที่ติดตาม

**แนวทาง:**
- `FollowButton.tsx` ใน profile page
- Tab "Following" ใน `/community` แสดง posts จาก user ที่ follow

---

#### 6. Translation Quality Feedback

**ปัญหา:** มี model toggle แต่ user ไม่มีช่องทาง feedback ว่าแปลผิด/ถูก — MIT ไม่ได้ signal กลับ

**ผลกระทบ:** ไม่รู้ว่า page ไหนแปลแย่, ปรับ MIT ไม่ได้จาก real usage

**Components ที่ต้องสร้าง:**
- Thumbs up/down เล็กๆ ใน `PageRenderer.tsx` มุมขวาล่าง
- Backend: `translation_feedback (user_id, manga_id, chapter, page, rating, comment?)` table
- ผูกกับ MIT improvement pipeline ในอนาคต

---

#### 7. Reading Statistics Dashboard

**ปัญหา:** `lib/readingHistory.ts` เก็บข้อมูลอยู่แล้ว แต่ไม่มี UI แสดง stats ให้ user

**Components ที่ต้องสร้าง:**
- `/settings/stats` หรือ tab ใน profile
- Cards: pages read / chapters read / hours spent / top genres
- Chart: reading activity per month (บาง library เช่น Recharts)

---

### 🟢 Nice-to-have — ทำเมื่อมีเวลา

---

#### 8. Content Report / Flag

**ปัญหา:** ไม่มีปุ่ม flag content ที่ไม่เหมาะสม

**แนวทาง:**
- `ReportButton.tsx` ใน `PostCard.tsx` + reader
- Modal เลือกเหตุผล (spam / inappropriate / wrong content)
- Admin queue ใน `/admin/content` ที่มีอยู่แล้ว

---

#### 9. Side-by-side Translation View

**ปัญหา:** ดูหน้าต้นฉบับ JP + แปลไทยคู่กันไม่ได้

**แนวทาง:**
- Toggle ใน reader toolbar: "แปล" | "ต้นฉบับ" | "คู่กัน"
- Layout split แนวนอน หรือ swipe เปรียบเทียบ
- ดีสำหรับ user ที่อยากเรียนภาษาญี่ปุ่นด้วย

---

#### 10. Daily Check-in / Coin Reward

**ปัญหา:** ไม่มี gamification ที่ดึง user กลับมาทุกวัน

**แนวทาง:**
- Modal check-in ตอน login ครั้งแรกของวัน
- Streak counter + coin reward เพิ่มตาม streak
- ผูกกับ wallet system ที่มีอยู่แล้ว

---

#### 11. Advanced Search Filters

**ปัญหา:** `/search` มีอยู่แต่ไม่ชัดเจนว่า filter genre/status/year เต็มแค่ไหน

**แนวทาง:**
- Filter panel: Genre, Status (ongoing/completed), Year, Language, Rating
- Sort: relevance / newest / most read / highest rated
- Save search presets

---

## Priority Matrix

```
HIGH IMPACT │ ① Notifications  ② Series Follow+Alert
            │ ③ Rating/Review
────────────┼──────────────────────────────────────────
MED IMPACT  │ ④ Reader Comments  ⑤ Follow User
            │ ⑥ Translation Feedback  ⑦ Reading Stats
────────────┼──────────────────────────────────────────
LOW IMPACT  │ ⑧ Report System  ⑨ Side-by-side
            │ ⑩ Check-in  ⑪ Advanced Search
            └──────────────────────────────────────────
              LOW EFFORT          HIGH EFFORT
```

**Recommended sequence:**
1. Series Follow (ง่ายสุด, impact สูง — ต่อจาก mylist ที่มีอยู่)
2. Rating/Review (standalone, ไม่ depend อะไร)
3. Notification System (ใหญ่กว่า แต่ครอบ use cases หลายอย่างพร้อมกัน)
4. Translation Feedback (เล็กมาก, เพิ่ม value ให้ MIT pipeline)
