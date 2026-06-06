# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on `Slow-Inc/MangaDock`. Use the `gh` CLI for all operations.

## Language: bilingual bodies (English + ไทย)

Every issue body and PR description must be **bilingual**:

- **Title**: English (conventional-commit style, e.g. `fix(MIT): ...`).
- **Body**: write each section in English first, then a mirrored Thai version — either as a `## สรุปภาษาไทย` section at the end covering the whole body, or as `EN / TH` paired paragraphs per section for long documents (PRDs).
- **Thai must mirror English exactly** — same level of detail, same sentence count, same depth. Never summarise, abbreviate, or omit information in the Thai version. If the English has five bullet points, the Thai has five bullet points. If the English has a table, the Thai has the same table. "สรุป" does not mean "shorter".
- Code identifiers, file names, log excerpts, and acceptance-criteria checkboxes stay in English; the Thai version explains them, never translates identifiers.
- Comments replying to reviews may be English-only; anything a human teammate reads to make a decision (issue bodies, PR descriptions, PRDs) gets both languages.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
