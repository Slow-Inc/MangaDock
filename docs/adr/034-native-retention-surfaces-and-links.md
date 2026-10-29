# ADR 034: Native retention surfaces and collection links

- Status: Source implemented; physical visual/live-service acceptance pending.
- Area: Mobile. Continues ADR 032 and 033; no Backend contract change.

## Context

Phase 5 has Web Collections/feeds and server contracts, while Mobile renders native screens. The user requested the recommended native follow-up. Embedding the new Web journeys would reintroduce a second UI runtime and would not implement the selected native release target.

## Decision

- Add a Mobile-owned subscribed retention controller (`Mobile/src/retention.ts`) over the existing authenticated feed/collection endpoints and anonymous public-collection endpoint. Reuse `createApi` identity headers and the existing session.
- Separate request channels with cancellation/revision guards, 15-second deadlines including body reads, and account-generation isolation. Keep all writes server-acknowledged without automatic retry. Do not duplicate server ownership, ranking or entitlement rules.
- Put Collections beneath Library and personal feeds beneath Community, preserving six existing bottom destinations. Reuse native post rendering and spoiler behavior. Preserve the feed when opening/returning from a post and preserve the intended retention destination through guest login.
- Extend the existing product-link parser with feed/collections and UUID collection destinations. Share installed-app `mangadock://collections/<uuid>` URLs only for public collections. HTTPS universal links and installation fallbacks require a separate domain association decision.
- Keep rollout flags, real service configuration and schema unchanged. New UI uses existing Mobile tokens; no new runtime package is required.
- Android Collections use a keyboard-resized viewport with the existing top safe-area offset, independently of collection count. Empty-list geometry is a physical acceptance gate; mocked host-widget tests cannot certify IME overlap. [29 October correction and device evidence](../../Mobile/docs/2026-10-29-native-keyboard-fix.md). / Androidย่อviewportตามkeyboardและชดเชยsafe-areaจริงโดยไม่พึ่งจำนวนคอลเลกชัน ต้องตรวจรายการว่างบนเครื่องจริง

## Alternatives considered

1. WebView for these two journeys: rejected because the release target is native UI.
2. New tabs/navigation framework or copied ranking/access logic: unnecessary; existing routes and Backend contracts cover this feature.
3. Immediately changing production schema/provider settings: independent release work, not needed for isolated source/contract verification.

## Consequences

Native screens can be verified with real React/controllers and real Nest/SQL fixtures without personal credentials. Those checks do not certify native layout, production networking or OS push. See the [delivery record](../../Mobile/docs/2026-10-24-native-retention.md) for commands, evidence and open acceptance gates. Invalid/private collection links remain visible retryable failures; visiting a link never grants ownership.

## ภาษาไทย

เพิ่ม Collections ใต้ Library และ Feed ใต้ Community โดยใช้ API/session เดิม ยืนยันผลเขียนจาก server แยกคำขอต่อช่องและบัญชี มี timeout รวม body ไม่ทำ ranking/สิทธิ์ซ้ำในแอป ใช้ post component เดิมและรักษาสปอยล์/Back/ปลายทางหลังล็อกอิน แชร์ deep link เฉพาะคอลเลกชันสาธารณะและตรวจ UUID ไม่ฝัง WebView ไม่เพิ่ม navigation framework/dependency ไม่เปลี่ยน schema/provider/rollout งาน HTTPS universal link และ acceptance เครื่องจริงยังแยกต่างหาก
