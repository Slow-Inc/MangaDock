---
name: feedback_notify_on_done_or_question
description: ยิง PushNotification ทุกครั้งที่งานเสร็จหรือมีเรื่องต้องถาม user จะได้ไม่ต้องเฝ้า terminal
metadata:
  type: feedback
---

User ต้องการให้แจ้งเตือนผ่าน desktop/Windows notification ทุกครั้งที่ **งานเสร็จ** หรือ **มีเรื่องต้องถาม/รอ confirm** เพื่อจะได้ไม่ต้องมาเฝ้า terminal ตลอด (สั่ง 2026-06-08)

**Why:** user มักทำงาน AFK ระหว่างที่ task ยาวรันอยู่ (เช่น E2E แปล, build) — ถ้าไม่เด้งเตือนจะไม่รู้ว่าถึงจุดที่ต้องตัดสินใจหรือเสร็จแล้ว

**How to apply — กลไกที่ใช้ได้จริงบนเครื่องนี้ (ยืนยัน 2026-06-08):** tool `PushNotification` ในตัว **ไม่ surface เป็น OS toast** บน Win11 + VS Code ของ user (ขึ้น "sent" แต่ไม่เด้ง ทั้งที่ไม่ได้เปิด DND). ใช้ helper แทน:
```
pwsh -NoProfile -File scripts/notify.ps1 -Message "ข้อความ <200 ตัว บรรทัดเดียว"
```
มันยิง **WinRT Toast ผ่าน Windows PowerShell 5.1** (pwsh 7 โหลด WinRT projection ไม่ได้ → ต้อง shell ออก `powershell.exe` 5.1; AppId = Windows PowerShell) → เข้า Action Center จริง + Phone Link ส่งต่อเข้ามือถือได้ (เครื่อง user เชื่อมมือถือด้วย Phone Link). หมายเหตุ: `powershell.exe` ไม่อยู่ใน PATH ของ env นี้ ใช้ full path `$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe`; อย่าใช้ `-ExecutionPolicy Bypass` (โดน classifier ปฏิเสธ) — `-File` กับ local script รันได้ใต้ RemoteSigned.

ยิงเมื่อ: (1) จบ task/รอบ /tdd, (2) ต้องถาม/รอ user confirm (เช่น ก่อนปิด issue ตาม [[feedback_self_review]], ก่อน merge), (3) AFK แล้วงานชุดเสร็จ ตาม [[feedback_test_every_round]]. อย่ายิงถี่ระหว่าง progress ย่อยๆ ที่ user เห็นอยู่แล้ว — เด้งเฉพาะจุดที่ต้องดึงความสนใจกลับจริงๆ
