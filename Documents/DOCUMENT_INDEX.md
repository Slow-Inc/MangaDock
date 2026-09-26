# MangaDock Documentation Index

> [!important] Academic / SE-course deliverables — **NOT the engineering source of truth.**
> This `Documents/` tree is human/examiner-facing (SRS, Gantt, UAT, UML). For the **current** architecture and decisions an AI agent or engineer should trust, use root **`CONTEXT.md`**, **`UBIQUITOUS_LANGUAGE.md`**, and **`docs/adr/`** — not this tree. Some files here freeze an earlier snapshot: **`Plan/Plan.md` and `Software Engineer/SE_PHASE1_*` still describe a Firebase/Firestore stack and exclude payment/mobile — the system has since migrated to Supabase + wallet + a mobile shell.** Treat those as historical.

เอกสารชุดนี้เป็นสารบัญกลางของเอกสารทั้งหมดในโครงการ MangaDock เพื่อให้ผู้อ่านสามารถเริ่มจากจุดเดียวแล้วไปยังเอกสารของแต่ละส่วนได้อย่างชัดเจน

## System Documentation

1. [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) สำหรับภาพรวมสถาปัตยกรรมทั้งระบบ
2. [Frontend/FRONTEND_DOC_INDEX.md](Frontend/FRONTEND_DOC_INDEX.md) สำหรับเอกสารสรุป Frontend (Next.js)
3. [Backend/BACKEND_DOC_INDEX.md](Backend/BACKEND_DOC_INDEX.md) สำหรับเอกสารสรุป Backend (NestJS)
4. [MIT/MIT_DOC_INDEX.md](MIT/MIT_DOC_INDEX.md) สำหรับเอกสารสรุป MIT (Manga Image Translator microservice)

## Software Engineering Report Documents

1. [Software Engineer/SE_PHASE_INDEX.md](Software%20Engineer/SE_PHASE_INDEX.md) สำหรับสารบัญเอกสารรายงานแยกตาม phase
2. [Software Engineer/UML_REPORT.md](Software%20Engineer/UML_REPORT.md) สำหรับเอกสารแผนภาพ UML และ diagram ประกอบรายงาน

## Product Requirements & Planning

1. [Plan/Plan.md](Plan/Plan.md) สำหรับแผนงานและ Roadmap ฉบับละเอียด
2. [Plan/PRD_COMMUNITY_FORUM.md](Plan/PRD_COMMUNITY_FORUM.md) สำหรับ PRD ของระบบ Community Forum (Phase 7.1)

## Folder Roles

- [Frontend](Frontend): เอกสารระดับระบบของฝั่ง Frontend
- [Backend](Backend): เอกสารระดับระบบของฝั่ง Backend
- [MIT](MIT): เอกสารระดับระบบของฝั่ง translation microservice
- [Software Engineer](Software%20Engineer): ชุดเอกสารหลักสำหรับรายงานวิชา Software Engineering

## Recommended Reading Paths

### For System Overview

1. [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md)
2. [Frontend/FRONTEND_DOC_INDEX.md](Frontend/FRONTEND_DOC_INDEX.md)
3. [Backend/BACKEND_DOC_INDEX.md](Backend/BACKEND_DOC_INDEX.md)
4. [MIT/MIT_DOC_INDEX.md](MIT/MIT_DOC_INDEX.md)

### For Software Engineering Paper

1. [Software Engineer/SE_PHASE_INDEX.md](Software%20Engineer/SE_PHASE_INDEX.md)
2. [Software Engineer/UML_REPORT.md](Software%20Engineer/UML_REPORT.md)
3. เอกสารระบบของ Frontend, Backend และ MIT ตามหัวข้อที่ต้องการอ้างอิง

## Summary

หากต้องการดูโครงสร้างระบบจริงให้เริ่มจาก [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) แล้วค่อยแยกไปยังเอกสารใน Frontend, Backend และ MIT แต่หากต้องการจัดบทของรายงานวิชาให้เริ่มจาก [Software Engineer/SE_PHASE_INDEX.md](Software%20Engineer/SE_PHASE_INDEX.md) และใช้เอกสารระดับระบบเป็น supporting documents