# ADR 006 — Bubble-aware detection & grouping: YOLOv8-seg balloons + safe-area narrow-column + SFX rescue

- **Status:** Accepted (2026-06-14) — **implemented, default-off.** Every knob below ships in the
  tree and is wired end-to-end, but each defaults to `False`/byte-identical, so a stock run is
  unaffected. The one partial seam: the balloon polygon's *narrow-column* consumption lives behind a
  separate render knob (`render.bubble_area_fit`, #166) that this layer only *feeds* — see ADR 007.
- **Context PRDs / issues:** #168 (SFX detect + VLM rescue), #170 (balloon seg + association),
  #172 (VLM SFX rescue), #178/#179 (safe-area narrow column), #169/#166 (bubble-area-fit consumer).
- **Relation to other ADRs:** the `bubble_polygon` / `bubble_box` this layer attaches is the input
  to ADR 007's narrow-column + bubble-area-fit renderer. This ADR documents the *detection /
  post-processing* half; ADR 007 documents the *render* half.

## Context

MangaDock's MIT pipeline detects text lines (DBNet), groups nearby lines into render crops, OCRs
each, translates, then composites a translated patch over the **original** page. Four independent
weaknesses in that detect→group→OCR front-end all degrade render parity, and four separate readers
filed them as unrelated issues. They are in fact **one detection-postprocessing layer**:

1. **Proximity-only grouping clumps across balloons.** `group_regions` (legacy) is a pure union-find
   over padded boxes: any two overlapping padded boxes merge. Two adjacent captions in *different*
   speech balloons collapse into one strip ("scattered-clump" bug), and a tall multi-line balloon
   whose lines drift apart can split into two crops.
2. **No balloon geometry to size/wrap text.** Without the balloon shape, translated English is wrapped
   to the *source text-line column* width — Japanese vertical columns are narrow, so English wraps
   into a tall thin ribbon instead of filling the round bubble.
3. **Wrapping to the bounding box gives wide paragraphs.** Even with a balloon box, wrapping to the
   *bbox* width over-fills round/irregular balloons; text spills past the ink at the curved top/bottom.
4. **Stylized SFX vanish.** The 48px line-OCR reads dialogue but (a) DBNet often never proposes a box
   for big stylized katakana SFX (e.g. ぬ), and (b) when it does, the OCR returns sub-floor garbage so
   `filter_translated_regions` drops the region before render. The status quo simply lost them.

These share one root: the front-end has **no notion of the speech balloon** and **no second-chance
path for text the primary detect/OCR misses**. Fixing them in one balloon-aware layer (rather than
four point patches) is what enables the downstream render-parity work.

## Decision

Add an **opt-in detection-enrichment layer**, four cooperating knobs, all default-off so a stock
pipeline stays byte-identical. The ML wrappers are isolated single-purpose modules (lazy model load,
best-effort: any failure → empty result → stage-off behaviour) so the geometry stays pure and
unit-testable in <1s.

**1. Balloon segmentation + association (`detector.det_bubble_seg`, #170).**
`bubble_detector.detect_bubbles` lazy-loads the YOLOv8-seg model **`kitsumed/yolov8m_seg-speech-bubble`**
(`model.pt`) — the model the MangaTranslator reference uses — and returns one polygon per balloon
(`bubble_detector.py:18`, `:34-53`). `_tag_regions_with_bubbles` (`manga_translator.py:1340-1370`,
gated at `:1439-1441`) calls `bubble_association.associate_regions_to_bubbles`, which assigns each
region to a balloon by **centroid point-in-polygon** (smallest-area balloon wins when nested), with
an **IoA fallback** (`MIN_IOA = 0.5`) when no polygon contains the centroid. Each tagged region gets
`bubble_idx`, `bubble_box` (polygon AABB), and `bubble_polygon` (`:1359-1367`).

**2. Balloon-aware grouping (`bubble_association.group_regions`).**
`_group_nearby_regions` (`manga_translator.py:1372-1388`) delegates to the pure `group_regions`
(`bubble_association.py:93-151`). It is the legacy proximity union-find made balloon-aware: two
regions still merge on padded-box overlap **except** when they sit in two *different* known balloons
(stops cross-balloon clumps), and two regions in the **same** balloon **always** merge however far
apart (a multi-line balloon stays one crop). With `bubble_idxs` all `None` (stage off) it is exactly
the legacy pure-proximity grouping — byte-identical.

**3. Safe-area narrow-column geometry (`safe_area.safe_area_box`, #178/#179).**
`safe_area_box` (`safe_area.py:31-71`, cv2/numpy only, no ML) ports MangaTranslator's
**distance-transform** safe-interior + **pole-of-inaccessibility** anchor: the largest centered
axis-aligned box that fits the balloon mask's interior (`dist >= padding`), with the anchor moved off
a conjoined-balloon neck to the deepest pixel when the centroid's distance `< pole_threshold (0.70) ×
max`. The renderer's `_bubble_interior_box` (`rendering/__init__.py:100-117`) rasterizes the carried
`bubble_polygon` and calls this so English wraps to the bubble's **true (narrow) column**, not its
bounding box. (This consumer fires only under the `render.bubble_area_fit` knob — ADR 007.)

**4. SFX detection + VLM OCR rescue (`detector.det_sfx` + `ocr.vlm_rescue`, #168/#172).**
- `det_sfx`: `detection_postproc.merge_sfx_detections` (`stages.py:48-49`) runs a **second** detector
  pass — `sfx_detector.detect_sfx_boxes` lazy-loads the AnimeText YOLO **`deepghs/AnimeText_yolo`**
  (`yolo12x_animetext/model.pt`, a **gated** repo → `HF_TOKEN`; `sfx_detector.py:20-21`, `:39-60`) —
  and merges boxes DBNet missed. `sfx_merge.dedup_sfx_boxes` drops any candidate already covered by a
  DBNet textline (IoA over the candidate's area ≥ `0.2`; `sfx_merge.py:14-33`); survivors join the
  flow as empty `Quadrilateral` textlines (`detection_postproc.py:32-37`).
- `vlm_rescue`: when the 48px OCR still drops a large region, the rescue gate
  (`manga_translator.py:761-781`) — for regions with area ≥ 3600 px and min side ≥ 24 px — sends the
  crop to the OpenAI-compatible **vision** gateway (`custom_openai` / 9arm) via
  `ocr_vlm.vlm_localize_sfx` (`ocr_vlm.py:66-105`) and gets back an English onomatopoeia.
  `sanitize_sfx` (`:41-52`) reduces the reply to one UPPERCASE token. A rescued region is flagged
  `sfx_rescued`; `restore_sfx_translations` (`ocr_vlm.py:55-63`, called at `manga_translator.py:898-899`)
  re-applies the localized SFX after translate (the translator blanks an already-English word, which
  would otherwise trip `filter_translated_regions`).

## Alternatives considered

| Option | Verdict |
|---|---|
| **Pure-proximity grouping** (legacy union-find, no balloon awareness) | **Kept as the off-path fallback, rejected as the default.** It merges adjacent-balloon captions into one strip and can split a multi-line balloon. `group_regions` keeps it byte-identical when `bubble_idxs` are all `None`, so the legacy behaviour is the graceful-degradation path, not the target. |
| **Bbox-width wrapping** (wrap English to the balloon bounding box) | **Rejected — wide paragraphs.** Over-fills round/irregular balloons; text spills past the curved ink. Distance-transform safe-interior wrapping (`safe_area_box`) is the chosen narrow-column geometry. It remains the *fallback* inside `_bubble_interior_box` when no polygon is present. |
| **Bbox-overlap heuristic for region↔balloon association** | **Rejected — unreliable for overlapping balloons.** Bounding-box overlap mis-assigns regions where two balloons' boxes overlap but their masks don't. Chosen: centroid **point-in-polygon** (smallest-area wins on nesting), with IoA only as a fallback. |
| **Dropping stylized SFX** (status quo before #168/#172) | **Rejected.** Big katakana SFX were simply lost — never proposed by DBNet, or OCR'd to sub-floor garbage and filtered out. The `det_sfx` second pass + `vlm_rescue` recover them. |

## Consequences

- **Positive.** One balloon-aware layer fixes four parity defects: no cross-balloon clumps, multi-line
  balloons stay one utterance, narrow-column wrapping fills round bubbles, and stylized SFX survive to
  render. It produces the `bubble_polygon` / `bubble_box` that **ADR 007's** narrow-column +
  `bubble_area_fit` renderer consumes. Every knob is default-off and the legacy path is preserved
  byte-identically (`group_regions` with no `bubble_idx`, `safe_area_box` fallback, stage-off returns
  on detector failure), so byte-identity holds for stock runs. The pure-geometry modules
  (`bubble_association`, `safe_area`, `sfx_merge`) import no ML and unit-test in <1s.
- **Negative / limits.**
  - **VRAM.** Two extra YOLO models load when enabled — YOLOv8m-seg (~490 MB GPU transient, ~30 ms/page
    after warmup, measured on the 12 GB box) plus the AnimeText YOLO second pass; neither is unloaded
    automatically inside the page loop (each module exposes `unload()` but the pipeline does not call it
    per-page).
  - **Network dependency.** `vlm_rescue` adds a hard runtime dependency on the external `custom_openai`
    / 9arm vision gateway and `HF_TOKEN` for the gated AnimeText repo. On any failure the rescue returns
    `''` and the region drops as before (no crash) — but the feature silently no-ops.
  - **Silent degradation.** All model loads are lazy + best-effort: if a model is absent or a download
    is ungranted, the stage logs a warning and behaves as if off. The enrichment quietly disappears
    rather than failing loudly, so an operator can think a knob is active when it is not.
  - The `safe_area_box` `padding`/`pole_threshold` and the IoA / area thresholds are tuned on the
    benchmark pages, not adaptive per page.
- **Follow-up.** Per-page `unload()` of the seg/SFX models if steady-state VRAM is ever measured to be
  the constraint; a pre-shipped or self-hosted SFX-rescue model to drop the external-gateway dependency;
  surfacing a clearer signal when a lazy model load degraded to stage-off so silent no-ops are visible.
