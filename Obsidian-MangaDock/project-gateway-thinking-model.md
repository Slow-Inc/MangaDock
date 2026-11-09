---
name: project-gateway-thinking-model
type: project
description: custom_openai gateway model qwen3.8-27b-fp8 thinks ~154 tokens before answering - any call with a small max_tokens silently returns empty content.
---

# Gateway default เป็น thinking model — max_tokens เล็ก = คำตอบว่าง

`CUSTOM_OPENAI_MODEL=qwen3.8-27b-fp8` บน `https://gateway.9arm.co/v1` เป็น thinking model: ใช้
~154 reasoning tokens ก่อนเริ่มเขียนคำตอบ (วัด 2026-10-22 กับ crop SFX ของ Boku p0)

ผลกับโค้ดที่ยิง gateway เอง (ไม่ผ่าน `custom_openai` translator):

| max_tokens | finish | content |
|---|---|---|
| 24 | `length` | `''` (reasoning กินหมด 24) |
| 128 | `length` | `''` |
| 192 / 256 / 384 / 512 | `stop` | `เฮ้อ` (reasoning 154) |
| 24 หรือ 512 + `enable_thinking=false` | `stop` | `ซึ่่ง` (ขยะ — คุณภาพตก) |

กติกา: **อย่าตั้ง max_tokens ต่ำกว่า ~256 กับ gateway นี้** และ **อย่าปิด thinking เพื่อประหยัด token**
(ปิดแล้วคุณภาพแย่ลงจริง) เหตุการณ์จริง: #881 — `vlm_localize_sfx` ส่ง 24 ทำให้ rescue เงียบทั้งหน้า
แล้ว breaker หยุด 300 s

เกี่ยวข้อง: [[project-render-knob-gating]] · [[project-mit-launch-env]] · [[feedback-root-cause-before-fix]]
