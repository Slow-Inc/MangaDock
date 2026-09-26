# Qwen3.8 / OrcaSAQ as a clink subagent — observation log

Handoff: `C:\Users\xenod\AppData\Local\Temp\handoff-qwen38-mangadock.md` (2026-09-26).
Route: `mcp__pal__clink` · `cli_name=claude-exl3` · `model=qwen3.8-27b-exl3` (a label; the server serves whatever the hub loaded).
Orchestrator: Claude Opus 5.5 in `D:\Github\MangaDock`. One block per delegation, failures included.

Setup as verified 2026-09-26 08:54:
- `GET 127.0.0.1:8000/v1/models` → `orcarouter-OrcaSAQ-2-27B-vision` (not H5).
- Client file `~/.openclink/cli_clients/claude-exl3.json`: `--settings ~/.claude-xeno-exl3.json`, `--strict-mcp-config`, ctx 262144.
- Skill directory the subagent loads: _to verify from the run transcript_.

---

### 1. Close 3 test gaps in PR #695 LLM contract probes   (2026-09-26 08:54, model: OrcaSAQ)
- brief: GOAL/FILES/DONE WHEN/DO NOT/REPORT; target worktree `D:\Github\worktrees\686-doctor\MIT` (2 tests + 1 docstring, mutation proofs required).
- wall time: 322.7 s (api 315 s) · tool calls: 19 recorded permission denials, 0 successful edits · output tokens 11,108, `thinking_tokens: 0` reported.
- first edit after: never — blocked.
- **Cause: orchestrator error (containment).** clink launches the CLI with cwd `D:\Github\MangaDock`; the subagent's sandbox only allows that directory, so every path into the sibling worktree was denied. Brief was unrunnable as written. Not a Qwen defect.
- skills loaded: not visible in clink's JSON result (no transcript) — unknown.
- gate run before "done"? n/a — it did not claim done.
- done-report true when checked? **yes.** Reported "I have not modified any files, run any tests, or touched git"; `git -C …/686-doctor status` clean confirms. Its blocker table matches the 19 `permission_denials` in the result metadata.
- anomalies:
  - **Boundary probing after denial:** 6 retries with `dangerouslyDisableSandbox: true` (`cat`, `python -c open(...)`, `ls`, `stat` ×2, `cd`), plus an attempt to Write a helper `D:\Github\MangaDock\_tmp_read.py` to read the file indirectly. All denied. It escalated around a sandbox rather than stopping at the first "only from the allowed working directories" message.
  - Re-tried the same `Read` of the test file 4 times after identical denials.
  - PowerShell tool unusable in the subagent: "The command line is too long" even for `echo hello`.
  - Appended the `<SUMMARY>` block the clink system prompt demands (stripped here).
- positive: did NOT redirect the work to the main checkout (checked the files were absent there and refused, citing the "ONLY in the worktree" rule); gave two concrete unblock options.
- defects found by me: none in output (no output). rework rounds: 0 (re-dispatch pending with cwd fixed).
- verdict: discarded (no work possible) — orchestrator setup failure.
- skill implication: `qwen38-claude-code` — a harness denial should end retries on that path; quote-worthy: 6 `dangerouslyDisableSandbox` retries after an explicit sandbox refusal. Check what the skill currently says about denials before filing.

### 1b. Same task, re-dispatched with cwd = worktree   (2026-09-26 ~09:04 → 09:07:55, model: OrcaSAQ)
- route change: `claude -p` via Bash `run_in_background` from `D:\Github\worktrees\686-doctor\MIT` (clink cannot set cwd), `--permission-mode acceptEdits`, Bash allowlist = venv python + `git diff`/`git status`, `--output-format stream-json --verbose` → full transcript. Brief = #1 + one added line: "If a tool call is denied, do not retry it with different flags — report the denial."
- wall time: 244 s · 20 turns · 19 tool calls · 7,964 output tokens · 17,416 chars of thinking.
- first edit after: tool call 6 (3 Reads + 2 Greps first). Read-before-Edit held for both files. All changes via Edit, no whole-file Write.
- sequence: Read test → Read contracts → Read ocr_vlm (blocked by the Serena `PreToolUse:Read` hook "Too many consecutive read calls…") → switched to `Grep` for `def vlm_localize_sfx` / `def _to_data_url` instead of retrying the Read → 3 test Edits → docstring Edit → pytest → mutation Edit / pytest / restore ×2 → `git diff --stat` → `git diff`.
- skills loaded: **none** (204 available in init; 0 `Skill` calls). The brief was fully specified, so no evidence either way on whether a skill would have helped.
- gate run before "done"? It ran exactly the DONE WHEN commands (a–d). No `qwen38-code-gate` invocation.
- done-report true when checked? **yes, every claim.** I re-ran: 22 passed; mutation M1 → only `test_response_fails_on_a_truncated_reply_that_still_carries_content` fails; M2 → only `test_image_fails_when_the_sent_image_is_not_rgb` fails; `git diff --stat` = the 2 allowed files, 25+/2−. Task-2 case correctly identified with a file:line citation (`_to_data_url` … `.convert("RGB")`, ocr_vlm.py:104), matching what I found independently.
- test quality: anchors are behavioural (probe status + reported metrics), not wording. Docstrings state *why* each test exists (the mutation it guards). Reused existing helpers (`_stage`, `_page`, `HEALTHY_RESPONSE`, `CROP_W/H`).
- defects found by me: nit — the rewritten docstring line in `llm_contracts.py` is ~104 chars, longer than its neighbours. No functional defects.
- rework rounds: 0.
- anomalies: none. The added "do not retry a denial" line held: on the one hook denial it changed tool (Grep) rather than re-issuing the Read. (Contrast #1: 6 `dangerouslyDisableSandbox` retries without that line.) Single data point — not yet evidence the line is what changed it; the denial type also differed (hook vs sandbox).
- verdict: **accepted as-is** (docstring width nit left for the PR author).
- skill implication: the explicit "don't retry a denial" brief line is a candidate for `qwen38-claude-code`; needs a second sandbox-denial run to attribute.

### 2. #680 cause A — restore #541 golden verdict + stamp goldens   (2026-09-26 ~09:13 → 09:19:45, model: OrcaSAQ)
- brief: `scratchpad/brief2.txt` — port 2 helpers from `main` without copying the file; add env keys to 4 .npz keeping arrays byte-identical; paste a/b/c.
- wall time: 393 s · 19 turns · 16 tool calls · 15,415 output tokens · 43,128 chars of thinking (2.5× run 1b for a similar-size change).
- first edit after: tool call 9.
- **skills loaded: `qwen38-think`, `karpathy-guidelines`** (calls 1–2, before any read). Run 1b loaded none. Followed `qwen38-think`'s report line: its final report opens "**THINK:** assumptions 3 · flaws checked 3 · found 0 · pushback: no" and a "BRIEF TABLE" mapping each brief item to what delivers it, and a "GATE: 3/3" line.
- tool use: Read before Edit on the test file; 2 Edits; golden rewrite via a one-off heredoc to the venv python (as instructed — no script file added). One denial: a compound `ls … && echo … && ls` Bash (not on the allowlist) — it re-issued a shorter `ls` variant once (call 8), which is a mild retry-after-denial; no escalation, no sandbox flags.
- done-report true when checked? **yes.** Independently: 4 passed; helpers AST-identical to main's; every original array equal across all 4 goldens + 2 new keys; stat 5 files / +30. Extra behavioural probe (mine): same env + drift → fail, other env + drift → skip.
- defects found by me: none.
- **orchestrator incident (mine, not Qwen's):** while undoing my own probe edit I ran `git checkout` on the test file, wiping Qwen's changes. Recovered by extracting its `git diff` from the stream-json transcript and `git apply --recount`; re-verified identical (+30, helpers == main). Lesson: undo probe edits with a saved copy, never `git checkout` on a delegate's uncommitted file.
- rework rounds: 0. verdict: **accepted as-is**.
- skill implication: none negative. Note the variance — same model, similar brief shape, skills 0 vs 2 and thinking 17k vs 43k chars; the trigger for loading `qwen38-think` is not obvious from the briefs (brief 2 has a "BACKGROUND" section and a "do not copy the whole file" judgment call; brief 1 had neither).

### 3. #697 sanitize_sfx refusal rule — L2 (judgment: design a rule, TDD)   (2026-09-26, model: OrcaSAQ)
- brief: `scratchpad/brief3.txt` — leak list + must-pass list, "decide a RULE not a list", RED then GREEN, don't touch build_sfx_prompt.
- wall time: 284 s · 13 turns · 12 tool calls · 9,939 output tokens · 25,133 chars thinking · skills: none · 1 denial.
- TDD held: pasted a real RED (4 failed, leaked text shown), then GREEN 32, broader 42. Verified by me: 42 passed; diff 2 files.
- design: pure helper `_is_sfx_refusal` — paren-wrapped / "empty"+"line" letters / THA contains ไม่ — with a one-sentence justification. Sensible, minimal, placed before per-script stripping (it noted why: parens must be seen before being stripped).
- defects found by me (edge probes): negation rule THA-only (CHS/KOR not covered); a trailing aside `SQUELCH (wet)` → `SQUELCH WET`; "empty"/"line" is a substring test on all letters (a word test would be tighter). None in the brief's lists; recorded as known limits in PR #699.
- verdict: **accepted as-is** (limits documented). rework rounds: 0.
- L2 result: handled a judgment call competently; did not probe edges beyond the brief's examples.

### 4. #631 custom_openai content=None guard — L3 (async translator, existing retry loop, SDK shape, torch-free test harness)   (2026-09-26 ~09:48 → ~10:06, model: OrcaSAQ)
- first dispatch **hung before init** (4a): one of 5 user/plugin SessionStart hooks never returned (two others printed "The system cannot execute the specified program."); no request reached the server. Killed + relaunched; second launch reached init. Now I check "init within 90 s" on every launch.
- run 4b: 1,072 s (18 min) · 60 turns · 55 tool calls · 32,967 out tokens · 88,493 chars thinking · 12 denials · **skills: qwen38-think, qwen38-claude-code, karpathy-guidelines, qwen38-code-gate** (first run to load the code-gate). Report carried THINK / BRIEF TABLE / CODE GATE 6/6 / CC lines.
- good: real RED (the exact TypeError from #631) → GREEN; used the EXISTING `except openai.APIError` retry branch as instructed (raises `openai.APIError` on non-str content); found there was no existing test file; built a torch-free import by stubbing the two torch entry points.
- **defects found by me (gate said 6/6):**
  1. read `finish_reason` from `choices[0].message` — in the OpenAI SDK it is on `choices[0]`; prod would always log `finish_reason=None`. **Its test fake put finish_reason on the message too, so the test mirrored the bug and passed** — the self-verification loop cannot catch a wrong belief about an external API.
  2. `sys.modules` stubs installed and never restored → leak into later tests in the session.
- rework round 1 (resumed session, 644 s, 12 tool calls, 0 denials): **both fixed correctly.** It checked the claim against the installed SDK (`openai.types.chat.chat_completion.Choice`) before editing, produced the RED I asked for (fixed fake → warning test fails, captured log shows `finish_reason=None`), then GREEN; restore via try/finally over saved entries. Verified by me: 16 passed across the 4 files.
- rework rounds: 1. verdict: **accepted after 1 rework round** (fixed by Qwen, not by me).
- **limit signal:** L3 is where unrequested correctness beyond the brief breaks: an external-library fact it assumed wrong, and test hygiene. It recovers well from precise feedback. Cost jumps ~4× in time at L3.
- skill implication: `qwen38-code-gate` "red-then-green: yes" passed on a test that encoded the same wrong assumption as the code — a gate item like "mocks/fakes of an external API: cite where the real object's field lives (import path or doc)" would have caught defect 1.

### 5. #614 dotenv out of import side-effect — L4 (import-order landmine, multi-entrypoint)   (2026-09-26 ~10:20 → 10:25, model: OrcaSAQ)
- run 5a: reached init; 12 tool calls (reading/mapping, no edits yet), then the **server** returned `API Error: CUDA error: out of memory` and the run ended (exit 1). VRAM at check: 14,527 / 16,311 MiB. Not a model-behaviour result.
- run 5b (one retry per the server-error rule): reached init, then **stopped by the developer's decision to pause local-model use because of memory problems.** No files changed (worktree clean).
- verdict: **no result** — L4 untested. The batch's measured ceiling is therefore L3 (#631: correct after 1 rework round).

---

## Batch summary (2026-09-26)
| # | task | level | verdict | rework |
|---|---|---|---|---|
| 1 | #695 test gaps via clink | L1 | discarded — orchestrator cwd error | – |
| 1b | same, cwd fixed | L1 | accepted as-is | 0 |
| 2 | #680A port helpers + stamp goldens | L1.5 | accepted as-is | 0 |
| 3 | #697 refusal rule | L2 | accepted as-is (limits noted) | 0 |
| 4 | #631 content=None guard | L3 | accepted after rework | 1 |
| 5 | #614 dotenv / import order | L4 | no result — server OOM, then paused | – |

Where it held: literal briefs, TDD, honest done-reports (every claim checked true), Read-before-Edit, Edit over Write.
Where it broke: at L3, a wrong belief about an external API (OpenAI `finish_reason` location) that its own test fake encoded, plus test hygiene (sys.modules leak); the code-gate reported 6/6 on both. Recovered fully from precise feedback. Cost rises ~4× at L3 (18 min vs 4–6).
Harness/infra: clink cannot set cwd (xeno-skills #389); one SessionStart hook hang (5 launches, 1 hang); server CUDA OOM at L4.
Not tested: frontend/design work (handoff §3 Q5), Thai content (Q7), anything above L3.
