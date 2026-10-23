# ADR 032: Android Phase 5 push lifecycle through Expo Push Service

Status: Accepted for the Mobile implementation slice, rollout disabled pending Backend and provider integration.

## Context

Main now contains a native Expo 56 client, user follows, an in-app inbox and an allow-listed native destination parser. Roadmap Phase 5 calls for Expo Push Service plus a durable multi-node server delivery pipeline. No push-device API or configured EAS/Firebase identity is currently present. The first Mobile slice must be buildable and testable independently.

## Decision

Use `expo-notifications` and an existing EAS project ID to obtain Expo Push tokens. Reuse accepted Supabase sessions, device headers, account settings and native routing. Put lifecycle coordination in a dependency-injected controller, with a narrow Expo OS adapter. Record opt-in per account, serialize registration/removal, reject stale completions and scope payloads to the recipient. Logout gets a pre-disposal cleanup hook; OS/network cleanup is bounded and best effort, with a persisted owner marker for retry. Push does not block product startup.

Keep rollout off by default. Propose the owner/token-scoped API in the [implementation contract](../../Mobile/docs/2026-10-23-phase5-push.md); do not silently deploy it or add a fake registration success. No sending credentials, live project creation, database mutation or server worker is part of this Mobile change.

## Alternatives considered

- Reintroducing WebView: conflicts with current main and duplicates the existing native screens.
- Direct FCM sender or a second notification library: adds another provider contract and deviates from the roadmap's Expo Push Service decision.
- Implementing an entire Backend outbox/queue in the Mobile slice: expands ownership beyond the Mobile work the user requested. A concrete contract allows parallel implementation.
- Prompting on launch: interrupts readers before they choose notifications; explicit opt-in preserves intent.

## Consequences

Mobile logic can be tested before real delivery infrastructure exists. Enabled native builds require Firebase Android config and a valid EAS UUID. Physical delivery, signed distribution and iOS are separate acceptance gates. Foreground recipient checks do not govern OS background presentation; Backend ownership/preferences, generic lock-screen copy and delivery receipt cleanup remain required. If both server removal and native invalidation fail while offline, remote removal is not guaranteed until retry.

## ภาษาไทย

สถานะ: รับการออกแบบสำหรับ slice Mobile โดยยังปิด rollout จน Backend/provider พร้อม

บริบท: main เป็น Native Expo 56 มี Follow/inbox/parser ปลายทางแล้ว roadmap เลือก Expo Push Service และท่อส่งหลาย node แต่ยังไม่มี API ลงทะเบียนหรือ EAS/Firebase config ที่พร้อมใช้ ต้องพัฒนา Mobile ให้ build/test แยกได้

การตัดสินใจ: ใช้ `expo-notifications` รับ Expo Push token จาก project เดิม ใช้ Auth/headers/หน้าบัญชี/router เดิม แยก controller ที่ฉีด OS boundary เพื่อทดสอบ เก็บ opt-in แยกบัญชี เข้าคิวลงทะเบียน/ถอนทะเบียนและไม่รับผลจากบัญชีเก่า ตรวจผู้รับใน payload มี hook cleanup ก่อนทิ้ง session จำกัดเวลารอและเก็บ marker เพื่อลองใหม่ ไม่บล็อกการเปิดแอปหลัก ปิด rollout เป็นค่าเริ่มต้น API ในเอกสารเป็นสัญญาเสนอใหม่ ไม่ deploy หรือรายงานลงทะเบียนสำเร็จปลอม ไม่เพิ่ม credentials/project/schema/worker ในงาน Mobile นี้

ทางเลือก: ไม่กลับไป WebView เพราะขัดกับ main ไม่เพิ่ม sender FCM ตรงหรือ library ซ้ำเพราะ roadmap เลือก Expo ไม่ขยายเป็น Backend outbox ทั้งระบบในงาน Mobile และขอสิทธิ์เฉพาะผู้ใช้กดเปิดแทนตอนเปิดแอป

ผลตามมา: ทดสอบ logic Mobile ได้ก่อน infra จริง Enabled build ต้องมี Firebase client config/EAS UUID ยังต้องรับ Push บนเครื่องและ signed release/iOS แยกกัน JavaScript ตรวจผู้รับเฉพาะ foreground ไม่คุม OS background จึงต้องมี Backend ตรวจเจ้าของ/preferences ข้อความ lock screen ที่ไม่มีข้อมูลส่วนตัว และ receipts cleanup ถ้าถอนทะเบียนทั้ง server/native ล้มเหลวตอน offline ยังไม่รับประกันผลจน retry
