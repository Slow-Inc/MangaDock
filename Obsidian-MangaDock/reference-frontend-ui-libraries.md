---
name: reference-frontend-ui-libraries
tags: ["reference"]
description: shadcn vs React Bits — บทบาทต่างกัน ใช้คู่กันได้; MCP setup สำหรับทั้งสอง
metadata:
  type: reference
---

## shadcn

- **บทบาท:** UI primitives ใช้งานได้จริงในระบบ — Button, Input, Dialog, Table, Form, Select ฯลฯ
- **พื้นฐาน:** Radix UI (accessibility + keyboard behavior ครบ) + Tailwind
- **โค้ด:** HTML + Tailwind class เรียบง่าย แก้ style ได้ทันที
- **เพิ่ม component:** `bunx --bun shadcn@latest add <name>` → copy source ลง `components/ui/`
- **MCP:** `mcp__shadcn__*` (project stdio server จาก `.mcp.json`). `@shadcn` registry ใช้ได้เลย; `@react-bits` ต้องให้ server รันจาก `Frontend/` (ดู Setup)

## React Bits

- **บทบาท:** Visual effects & animated components — background, motion, cursor, particle
- **พื้นฐาน:** WebGL (OGL), Canvas, GLSL shader — ใช้ GPU
- **โค้ด:** เขียน shader เองทั้งหมด (Aurora = GLSL 80+ บรรทัด + OGL renderer)
- **เพิ่ม component:** ดึง source code ผ่าน MCP แล้ว copy ลง `components/` เอง
- **MCP:** `mcp__reactbits__*` — `list_categories`, `list_components`, `search_components`, `get_component`, `get_component_demo`

## เปรียบเทียบ

| | shadcn | React Bits |
|--|--------|-----------|
| ใช้ทำอะไร | ระบบ UI ใช้งานได้จริง | Visual effect / ความสวยงาม |
| พื้นฐาน | Radix UI + Tailwind | WebGL / Canvas / GLSL |
| Performance | เบา | หนัก (GPU) |
| Accessibility | ✅ ครบ | ❌ ไม่ใช่จุดประสงค์ |
| ใช้คู่กัน | ✅ | ✅ |

**Pattern:** shadcn สำหรับ form/button/modal, React Bits สำหรับ background/animation ของหน้า

## Setup ใน MangaDock Frontend

- `components.json` อยู่ที่ `Frontend/` — style `radix-rhea`, lucide, rtl, aliases `@/components/ui` + `@react-bits` registry
- **shadcn MCP cwd gotcha (fixed 2026-06-14):** Claude Code `.mcp.json` **ไม่มี field `cwd`** (set `CLAUDE_PROJECT_DIR`=repo root แทน) → ถ้า command เป็น `npx shadcn mcp` ตรงๆ server รันจาก repo root (ไม่มี components.json) เห็นแค่ default `@shadcn`, `@react-bits`="Unknown registry". **Fix:** root `.mcp.json` → `pwsh -File ${CLAUDE_PROJECT_DIR}/Frontend/run-shadcn-mcp.ps1` (wrapper `Push-Location $PSScriptRoot` → cd Frontend/ → `npx shadcn@latest mcp`). **ต้อง full restart Claude Code** (`/mcp reconnect` ไม่ reload config). verify: `get_project_registries` ต้องโผล่ `@react-bits`
- `@react-bits` ยังใช้ผ่าน `mcp__reactbits__*` (MCP แยก) ได้เสมอ ไม่ขึ้นกับ fix นี้
