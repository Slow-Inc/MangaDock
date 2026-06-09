---
name: project-animetext-approved
description: User approved downloading the AnimeText YOLO model (deepghs/AnimeText_yolo) for #168 SFX detection on 2026-06-09 — the .pt security gate is cleared for this model
metadata:
  type: project
---

The standing rule is that model `.pt` downloads need explicit user approval (security gate). On **2026-06-09** the user approved downloading **`deepghs/AnimeText_yolo`** (file `yolo12x_animetext/model.pt`, ~400MB, local name `animetext_yolov12x.pt`) for the **#168 SFX / outside-speech-bubble (OSB) text** detector.

This is the same detector MangaTranslator uses (`ModelType.YOLO_OSBTEXT`, `model_manager.py:126,193`): detect OSB/SFX text → expand bubble box → OCR → translate → uppercase → render with a 3px contrast outline. See docs/research/render-parity-port-plan.md (gaps E+F).

**Downloaded 2026-06-09** (119 MB, gated access granted to HayateOtsu): `C:\Users\gamin\.cache\huggingface\hub\models--deepghs--AnimeText_yolo\snapshots\<rev>\yolo12x_animetext\model.pt`. The HF token lives in `MIT/.env` (`HF_TOKEN=`), authenticated as HayateOtsu. The repo is **gated** — needed a one-click "Agree and access repository" on huggingface.co before download worked (401→403→ok).

Approval is for this model only; other `.pt` downloads still need their own approval.
