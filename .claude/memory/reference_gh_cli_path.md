---
name: reference_gh_cli_path
description: gh CLI ไม่อยู่ใน Bash PATH — ใช้ full path C:\Program Files\GitHub CLI\gh.exe เสมอ (repo Slow-Inc/MangaDock)
metadata:
  type: reference
---

`gh` CLI **ไม่อยู่ใน PATH ของ Bash tool** (`gh: command not found`) และ `Get-Command gh` ใน PowerShell tool ก็คืน NOT FOUND. ติดตั้งจริงอยู่ที่:

```
C:\Program Files\GitHub CLI\gh.exe
```

ใช้ full path เสมอสำหรับ GitHub ops ทุกครั้ง เช่น:
```powershell
& "C:\Program Files\GitHub CLI\gh.exe" issue list --repo Slow-Inc/MangaDock --state open
```

- repo = **Slow-Inc/MangaDock** (origin `https://github.com/Slow-Inc/MangaDock`)
- label vocab: `ready-for-agent` (Ready for AI agent), `MIT`, `Feature`, `bug`, `needs-triage`, `ready-for-human`, `epic`, `effort:high/medium/xhigh`, `model:opus-4.8`
- issue ownership: ทำเฉพาะ author `xenodeve` หรือ tag ready-for-agent — ของ akkanop-x/Mobile ไม่แตะ ([[feedback_issue_ownership_scope]])
