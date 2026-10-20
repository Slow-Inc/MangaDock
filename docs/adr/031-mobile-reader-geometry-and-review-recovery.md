# ADR 031 — Native Reader geometry and review recovery

Status: Accepted for implementation, 2026-10-20. Device acceptance is recorded separately in [the fix report](../../Mobile/docs/2026-10-20-review-fixes.md).

## Context

Physical QA at `443dc80` found wrong history restoration, lost related-book Back history, unusable paged swipes, unsafe modal bottoms and contradictory translation counts. Existing stores and React Native primitives suffice; no additional navigation or gesture dependency is needed.

## Decision

- Keep one image-ratio map in the Reader and derive both rendered row heights and FlatList `getItemLayout` from it. Unknown images retain the existing 1.4 ratio; image load updates both together. Use explicit offsets and native visible-content anchoring, keeping pending scroll requests until the target becomes visible. Retain virtualization and lazy image loading.
- Keep a stack of successful book details/chapters inside the existing catalog store. Back pops it without refetching; explicit close clears it. Key the detail ScrollView by book ID to reset scroll on a different book. Reader close still returns to its current book.
- At normal zoom disable inner horizontal image scrolling so page gestures reach the parent responder. Keep zoomed panning; only one-finger horizontal releases turn pages. Initialize pinch geometry on transition to two fingers.
- Successful empty API bodies represent null; malformed nonempty JSON remains an actionable Thai error. Modal content includes its own safe-area padding. Translation state records requested page indices, and terminal failures classify unresolved requested pages instead of reporting them pending indefinitely.

## Alternatives considered

Average-height retries cannot position variable-height pages deterministically. Loading every image up front would defeat lazy loading. A new navigation/gesture framework adds migration scope without being necessary for these defects. Masking all JSON errors as null would hide malformed service responses.

## Consequences

Geometry recomputation is O(page count) per image-size/zoom change; images remain virtualized. Exact intrinsic ratios become known only after image load, so native anchoring and real-device checks remain necessary. Book history exists only within the current catalog lifetime. No database, provider or wire-contract migration is required. Revert the Mobile changes together to roll back.

## ภาษาไทย

QA บนเครื่องจริงพบตำแหน่งอ่านต่อผิด ประวัติ Back ของเรื่องที่เกี่ยวข้องหาย การปัดหน้าใช้ไม่ได้ modal ทับแถบระบบ และตัวนับแปลขัดกับ error ใช้ stores และ React Native เดิมโดยไม่เพิ่ม dependency

เก็บอัตราส่วนภาพใน Reader จุดเดียวแล้วคำนวณทั้งความสูงที่แสดงและ `getItemLayout` จากข้อมูลเดียวกัน ภาพที่ยังไม่โหลดใช้อัตราส่วนเดิม 1.4 เมื่อโหลดแล้วอัปเดตทั้งสองพร้อมกัน ใช้ offset ชัดเจนกับ native anchoring คง virtualization และโหลดภาพตามที่ต้องใช้ ไม่โหลดทั้งตอนล่วงหน้า เก็บ stack รายละเอียด/ตอนเฉพาะคำขอที่สำเร็จ Back คืนค่าจาก stack ส่วน close ล้างประวัติ และเปลี่ยน key ScrollView ตามเรื่องเพื่อคืนตำแหน่งบนสุด

ปิด horizontal scrolling ของภาพที่ซูมปกติเพื่อให้ parent รับ swipe คงการ pan เมื่อซูม แยก pinch ออกจาก swipe และตั้งต้น geometry เมื่อเพิ่มนิ้ว สำเร็จแต่ body ว่างคืน null ส่วน JSON เสียยังแจ้ง error ภาษาไทย modal บวก safe area เอง และการแปลนับเฉพาะหน้าที่ร้องขอพร้อมจัดหน้าที่ยังไม่สำเร็จเป็น failed เมื่อ request จบ

ไม่ใช้ retry จากความสูงเฉลี่ยเพราะภาพสูงต่างกัน ไม่โหลดทุกภาพก่อนอ่านเพราะเสีย lazy loading และไม่เพิ่ม framework เกินขอบเขต การคำนวณ geometry เป็น O(จำนวนหน้า) เมื่อขนาดภาพ/zoom เปลี่ยน ยังต้องตรวจ native anchoring บนเครื่องจริง ประวัติหน้าเรื่องอยู่เฉพาะอายุ catalog ไม่เปลี่ยน database/provider/API และย้อนกลับโดย revert Mobile ชุดนี้ร่วมกัน
