#!/bin/bash
# gemini-agents.sh
# วิธีใช้: bash gemini-agents.sh [g1|g2|g3|g4|g5]

case "$1" in

  g1)
    echo "🔍 Running G-1: Repo Scan..."
    gemini "
You are a senior software architect. Analyze this repository and produce THREE files.

### PLAN.md
- Project purpose (2-3 sentences)
- Tech stack with versions
- Folder structure explanation (top 2 levels only)
- Entry points
- Key external dependencies

### CONTEXT.md
- Key modules and what each does
- Data flow: input → processing → output
- State management approach
- Auth/session handling if any
- API surface

### RISKS.md
- Top 5 areas most likely to break
- Code smells spotted
- Missing error handling locations
- Security surface concerns
- Test coverage gaps

Rules:
- Each file max 200 lines
- Write for another AI to read, not humans
- Flag unreadable files with [UNREADABLE: reason]
" > /tmp/gemini-g1-output.txt

    # แยกไฟล์จาก output
    awk '/^### PLAN.md/{flag=1; file="PLAN.md"; next} /^### CONTEXT.md/{flag=1; file="CONTEXT.md"; next} /^### RISKS.md/{flag=1; file="RISKS.md"; next} flag{print > file}' /tmp/gemini-g1-output.txt    
    echo "✅ Created: PLAN.md, CONTEXT.md, RISKS.md"
    ;;

  g2)
    echo "🔍 Running G-2: PR Diff Review..."
    DIFF=$(git diff origin/main...HEAD 2>/dev/null || git diff HEAD~1...HEAD)
    gemini "
You are a code reviewer focused on architecture and scalability.

Review this git diff:

$DIFF

Produce PR_REVIEW_GEMINI.md with:

## Summary
- What changed (2-3 sentences)
- Risk level: LOW / MEDIUM / HIGH
- Recommended action: APPROVE / REQUEST_CHANGES / NEEDS_CLAUDE_REVIEW

## Architecture Impact
- Breaks existing patterns? Y/N + why
- New dependencies introduced?
- Coupling/cohesion changes?

## Scalability
- Holds under 10x load?
- N+1 queries, sync blocks, memory leaks?

## Flag for Claude
List sections needing deep review:
- [FILE:LINE] - reason

Rules:
- Skip naming, formatting, style (Copilot handles that)
- If clean: write '✅ No issues' and move on
- Max 150 lines
" > PR_REVIEW_GEMINI.md
    echo "✅ Created: PR_REVIEW_GEMINI.md"
    ;;

  g3)
    echo "⚙️  Running G-3: Boilerplate Generator..."
    echo "Feature to scaffold: "
    read FEATURE
    gemini "
You are a senior developer. Generate production-ready boilerplate.

Feature: $FEATURE
Follow patterns from: PLAN.md and CONTEXT.md (read them first)

Produce all necessary files with:
- Full working code (no placeholders)
- Basic error handling
- Consistent naming with existing codebase

After generating, append to PLAN.md under section:
## New: $FEATURE
- Files created: [list]
- Integration points: [where to connect]
- What Claude needs to review: [specific logic concerns]
"
    ;;

  g4)
    echo "🗜️  Running G-4: Context Compressor..."
    echo "Files to include (space-separated): "
    read FILES
    gemini "
Read PLAN.md, CONTEXT.md, and these specific files: $FILES

Produce CLAUDE_BRIEF.md:

## Task
[Single sentence: what Claude needs to do]

## Minimum Context
- Key function/class: [name + what it does in 1 line each]
- Dependencies it touches: [list]
- Current behavior: [what it does now]
- Desired behavior: [what it should do]

## Constraints
- Must not change: [list]
- Must maintain: [interfaces, contracts]
- Edge cases to handle: [list]

## Relevant Code Snippet
[Paste ONLY the exact function/class Claude must work on]

Rules:
- CLAUDE_BRIEF.md must be under 100 lines
- Include less, not more when unsure
- Do not include anything Claude does not need
" > CLAUDE_BRIEF.md
    echo "✅ Created: CLAUDE_BRIEF.md"
    ;;

  g5)
    echo "📝 Running G-5: Documentation Writer..."
    gemini "
You are a technical writer.

Read all source files in the project.
Read existing docs if present.

Update or create:
- README.md (project overview, setup, usage)
- API.md (all public interfaces with types and examples)
- CHANGELOG.md (from recent git log)

Rules:
- Write for developers new to this codebase
- Include runnable examples, not pseudocode
- Mark deprecated APIs with [DEPRECATED]
- Do not document internal/private functions
"
    ;;

  *)
    echo "Usage: bash gemini-agents.sh [g1|g2|g3|g4|g5]"
    echo ""
    echo "  g1 — Repo Scan → PLAN.md, CONTEXT.md, RISKS.md"
    echo "  g2 — PR Review → PR_REVIEW_GEMINI.md"
    echo "  g3 — Boilerplate Generator"
    echo "  g4 — Context Compressor → CLAUDE_BRIEF.md"
    echo "  g5 — Documentation Writer"
    ;;
esac

exit 0

# --- DO NOT EDIT BELOW THIS LINE - MANAGED BY GEMINI CLI ---

# MangaDock Engineering Standards & Roadmap (V5 Master)

## 🏛️ เสาหลักวิศวกรรม T4-STANDARD
1. **Idempotent Pipelines:** ทุก Operation ต้อง Retry-safe ข้อมูลไม่ซ้ำซ้อน
2. **Webhook Integrity:** การสื่อสารภายนอก (MIT, Payments) ต้องมี HMAC Signature
3. **2-Layer Cache:** L1 (In-Memory) + L2 (Redis) รองรับ Horizontal Scaling และระบบ Fail-safe
4. **Worker Memory Contract:** แยกงานหนัก (AI) ออกจาก Main Process เพื่อความเสถียร
5. **Zero-Trust Assets:** ปกป้องรูปภาพผ่าน Hardware ID และ Cloudflare Worker Buffer
6. **Observability:** Structured JSON Logging + Real-time Monitor (Dev Dashboard)
7. **Premium Design:** Liquid Glass Aesthetics และ Zero-Emoji Policy

## 📦 แผนการดำเนินงาน 5 Phase (V5 Master)
- **Phase 1:** Core Foundation & Multi-Auth (Completed ✅)
- **Phase 1.5:** Stabilization, Forum Hub & Industrial Hardening (Completed & Hardened ✅)
- **Phase 2:** Architectural Scaling (Cache Refactor), Payment & Cloud Readiness
- **Phase 3:** Hybrid Mobile Framework (WebViewer + Bridge & Code Sharing)
- **Phase 4:** Native OS Power Features (Screen Capture & Window Overlay)
- **Phase 5:** Retention Ecosystem & Community 2.0

## 💾 ยุทธศาสตร์ Cache (L2-Centric Architecture)
- **L2 (Redis) เป็น Source of Truth:** ทุกเครื่องเขียนลง L2 ก่อนเสมอเพื่อความถูกต้องและ Atomic Operations
- **L1 (In-Memory) เป็น Read Mirror:** ซิงค์ข้อมูลข้ามเครื่องผ่าน Redis Pub/Sub (Versioned Cooperative)
- **Workload-Aware Batching:** เลือก Leader จากเครื่องที่ CPU Load ต่ำที่สุดเพื่อประมวลผล JSON -> Supabase
