---
name: project-community-forum
description: Community forum + image upload system; SE project background and team info
metadata: 
  node_type: memory
  type: project
  originSessionId: 32a9fff7-e31f-4d8b-812b-d3e669fd80af
---

## MangaDock — Project Background

**ชื่อเดิม (SE class):** MetaBooks
**มหาวิทยาลัย:** มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ (KMUTNB)

**ทีม SE เดิม (4 คน):**
- ดุลยพัฒน์ จิรายุพัฒนา — 6604022630179
- ทรงวุฒิ ลักษณโกเศศ — 6604022630187
- วรลภย์ ดอกคำ — 6604022630357
- ธีรุตม์ ดอกกฐิน — 6604022630250 (user / Tech Lead)

**Project ปี 4:** เหลือ 2 คน — ธีรุตม์ + วรลภย์

## Community Forum Image Upload (2026-05-24)

Backend endpoint: `POST /forum/upload-image` (multer, 5MB, saves to `uploads/forum/`)
Uploaded images served via backend static assets + Next.js rewrite `/uploads/:path*`
Direct URL input also supported
`forum_posts.image_urls TEXT[]` DB column added via migration

**Key files:**
- `Backend/src/forum/forum.types.ts` — `imageUrls` on `ForumPost` and `CreatePostDto`
- `Backend/src/forum/forum.service.ts` — `uploadImage()` method
- `Backend/src/forum/forum.controller.ts` — `POST /forum/upload-image`
- `Frontend/app/components/PostImageUploader.tsx` — new component
- `Frontend/app/community/page.tsx` — image uploader in modal
- `Frontend/app/components/PostCard.tsx` — image grid display
- `Frontend/app/community/p/[id]/page.tsx` — full image gallery

Using plain `<img>` tags (not `next/image`) for forum images — external URLs can't be pre-listed in remotePatterns.
