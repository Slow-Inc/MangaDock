# Debugger-hook / process-exit audit across the MIT package (reliability pass)

- **Date:** 2026-10-23 · grep over `manga_translator/**/*.py` for `breakpoint()`, `pdb.set_trace`, `import pdb`,
  `sys.exit(`.

## Findings

| location | context | risk | action |
|---|---|---|---|
| `ocr/xpos_relative_position.py` `apply_rotary_pos_emb2d` | normal function body | **real landmine** — dead today (never called) but a future caller would freeze a worker in pdb | **fixed, #1059** (one-line removal) |
| `detection/default_utils/DBNet_resnet34.py:135` | `if __name__ == '__main__':` smoke test | none — dev entry point only | left as-is |
| `inpainting/inpainting_lama.py:696` | `test_model()` called only under `__main__` | none — dev entry point only | left as-is |
| `utils/panel/kumikolib.py:62,115` | CLI-only paths (PDF extraction missing `pdftoppm`, invalid `--save-panels` dir) | none for the worker — `get_panels_from_array` never reaches them | left as-is |
| `utils/panel/lib/page.py:77` | license-sidecar JSON invalid when reading a *file* page | none for the worker — array path has no filename/license | left as-is |
| `__main__.py` exits | CLI entry point | by design | left as-is |

## Result

The only production-relevant hook was the XPOS one, already removed in #1059; every other hit is either a
`__main__`-guarded development smoke test or a CLI-only error path. A production worker can no longer be dropped
into pdb by any of them.