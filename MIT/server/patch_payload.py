"""Patch-result normalization (#158).

One seam turns the worker's raw patch result (PNG bytes) into the wire shape
used by BOTH the single-page response (main.py) and the per-page webhook
payload (batch_runner.py) — previously two copies of the same loop. Carries
the page's text layer (`regions: [{src, dst}]`); old worker results without
it normalize to an empty list (backward compatible).

Import-light (base64 only — same pattern as server/webhook.py) so it
unit-tests in <1s without the ML stack.
"""
import base64


def normalize_patch_result(patch_result: dict) -> dict:
    patches_out = []
    for patch in patch_result.get("patches", []):
        png_bytes = patch.get("img_png", b"")
        patches_out.append({
            "x": patch.get("x", 0),
            "y": patch.get("y", 0),
            "w": patch.get("w", 0),
            "h": patch.get("h", 0),
            "img_b64": base64.b64encode(png_bytes).decode("utf-8"),
        })
    return {
        "img_width": patch_result.get("img_width", 0),
        "img_height": patch_result.get("img_height", 0),
        "patches": patches_out,
        "regions": patch_result.get("regions", []),
    }
