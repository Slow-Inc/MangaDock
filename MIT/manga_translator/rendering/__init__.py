import os
import re
import cv2
import numpy as np
from typing import List
from shapely import affinity
from shapely.geometry import Polygon
from tqdm import tqdm

# from .ballon_extractor import extract_ballon_region
from . import text_render
from ..font_fit import fit_font_size, font_high_cap
from ..bubble_association import balloon_occupancy
from ..render_overlap import clamp_box_to_neighbors, apply_font_cap, centered_box, clean_wrap_width, processing_scale, font_bounds, clean_layout_font_size, clean_layout_target_fs, region_territory_box, display_sfx, bubble_fit_bounds, fills_bubble_width, squeeze_width, box_containment
from ..safe_area import safe_area_box
from ..reference_layout import fit_to_box
from .text_render_eng import render_textblock_list_eng
from .text_render_pillow_eng import render_textblock_list_eng as render_textblock_list_eng_pillow
from ..utils import (
    BASE_PATH,
    TextBlock,
    color_difference,
    get_logger,
    rotate_polygons,
)

logger = get_logger('render')

def parse_font_paths(path: str, default: List[str] = None) -> List[str]:
    if path:
        parsed = path.split(',')
        parsed = list(filter(lambda p: os.path.isfile(p), parsed))
    else:
        parsed = default or []
    return parsed

def fg_bg_compare(fg, bg):
    fg_avg = np.mean(fg)
    if color_difference(fg, bg) < 30:
        bg = (255, 255, 255) if fg_avg <= 127 else (0, 0, 0)
    return fg, bg

def count_text_length(text: str) -> float:
    """Calculate text length, treating っッぁぃぅぇぉ as 0.5 characters"""
    half_width_chars = 'っッぁぃぅぇぉ'  
    length = 0.0
    for char in text.strip():
        if char in half_width_chars:
            length += 0.5
        else:
            length += 1.0
    return length

# #175 sizing safety: text was rendering too big and clipping at the balloon
# edge. _LINE_HEIGHT approximates real per-line height (ascent+descent ≈ 1.2×
# font) so the vertical fit isn't under-estimated; _FIT_MARGIN fits to 92% of the
# box so rounding/glyph slack can't touch the edge; _MAX_FONT_BOX_RATIO caps the
# font at half the box height so a short line in a big balloon isn't a giant.
_LINE_HEIGHT = 1.2
# #175 follow-up: a display caption may render taller than its original footprint once the font
# tracks the original size (the translation often needs more lines). Allow it to grow to this ×
# the source box height before shrinking the font, so big captions stay prominent without
# spilling far past where the original lettering sat.
_CLEAN_DISPLAY_H_TOL = 1.6
_CLEAN_DISPLAY_W_TOL = 1.6  # #430: symmetric width bound for a sized-up display caption
_FIT_MARGIN = 0.92
_MAX_FONT_BOX_RATIO = 0.5

# #175/#181/#183 length-ratio sizing: when the translation is longer than the
# source, grow font + bounding box proportionally. _LEN_RATIO_FONT_GAIN is the
# font/box growth per unit of length increase, _FONT_SIZE_SCALE_GAIN the box
# growth per unit of font-size delta, _MAX_BBOX_SCALE the final scale clamp.
_LEN_RATIO_FONT_GAIN = 0.3
_FONT_SIZE_SCALE_GAIN = 0.4
_MAX_BBOX_SCALE = 1.1


def _bubble_fit_layout(region, bubble_wh, img_shape, font_size_minimum: int = 8, bubble_bbox_w=None):
    """#175/#183: choose the font AND wrap-column for a region that fills a balloon. (1) binary-
    search the largest font whose word-wrapped translation fits the balloon safe-area, bounded
    by the interior height (:func:`bubble_fit_bounds`) and never force-breaking a word. (2) width-
    SQUEEZE the column (:func:`squeeze_width`) so the text uses more lines and fills the box
    HEIGHT — a tall balloon gets a narrow tall column (like the original) instead of a few wide
    lines with empty space below. Returns ``(font_size, block_w, block_h)`` — the squeezed block
    the caller centres in the balloon."""
    w_box, h_box = bubble_wh
    lang = getattr(region, 'target_lang', 'en_US')
    text = region.translation
    mw, mh = int(w_box * _FIT_MARGIN), int(h_box * _FIT_MARGIN)
    # #430 SIMPLE-A (multi-agent consensus): a single unbreakable word wider than the safe-interior
    # column may use up to the balloon's BBOX width (capped) so a long Thai word ("ถุงพลาสติก") in a
    # narrow balloon isn't pinned tiny. ONLY the width CEILING relaxes — line wrapping + anchor stay
    # in the safe interior. Cap = min(0.92·bbox, 1.20·safe), never below the safe width; the
    # distance-transform already proved the safe→bbox band is mostly clear of the bubble's corners,
    # so 0.92·bbox is the containment guard (no pixel check needed). bbox absent → exactly the safe
    # width → byte-identical for every existing caller / the wide One-Punch case.
    _wmax_safe = float(w_box * _FIT_MARGIN)
    word_wmax = _wmax_safe
    if bubble_bbox_w and bubble_bbox_w > 0:
        word_wmax = max(_wmax_safe, min(0.92 * float(bubble_bbox_w), 1.20 * _wmax_safe))

    # Segment Thai/Chinese into words first (region.translation is raw — the ZWSP word breaks
    # are inserted inside calc_horizontal, not here), so the longest-token checks below are
    # word-aware in every language instead of treating a whole spaceless Thai line as one word.
    _seg = text_render._insert_cjk_word_breaks(
        text_render._insert_thai_word_breaks(text or ''))
    _toks = [t for t in re.split(r'[\s​]+', _seg) if t]
    _longest = max(_toks, key=len) if _toks else ''

    def _longest_word_w(size):
        if not _longest:
            return 0.0
        _, lww = text_render.calc_horizontal(
            size, _longest, max_width=10 ** 7, max_height=10 ** 7, language=lang)
        return max(lww) if lww else 0.0

    def measure(size):
        lines, widths = text_render.calc_horizontal(
            size, text, max_width=mw, max_height=mh, language=lang)
        block_w = max(widths) if widths else float('inf')
        block_h = len(lines) * size * _LINE_HEIGHT
        if word_wmax > _wmax_safe:
            # #430 SIMPLE-A (bbox gave headroom): a line may exceed the safe width ONLY if it is a
            # single unbreakable word (can't wrap tighter) that still fits the relaxed bbox ceiling.
            # A MULTI-word line over the safe width means the font is simply too big — reject it, so
            # normal wrapping/One-Punch stays bound to the safe interior.
            if _longest and _longest_word_w(size) > word_wmax:
                return float('inf'), float('inf')
            for _ln, _w in zip(lines, widths):
                if _w > _wmax_safe and len([t for t in re.split(r'[\s​]+', _ln) if t]) > 1:
                    return float('inf'), float('inf')
            return min(block_w, _wmax_safe), block_h   # a lone over-wide word must not block the fit
        # reject a size that force-breaks a single WORD wider than the column ("HMPH"→"HM/PH").
        if _longest and _longest_word_w(size) > mw:
            return float('inf'), float('inf')
        return block_w, block_h

    # Fill the balloon — bound the search by the interior BOX HEIGHT, not page-area scale (the
    # per-crop patch path makes processing_scale meaningless; see bubble_fit_bounds).
    low, high = bubble_fit_bounds(h_box, font_size_minimum)
    font = fit_font_size((w_box, h_box), measure, low=low, high=high, margin=_FIT_MARGIN)

    # #430 item-2 (height under-fill): fit_font_size binary-searches assuming the fit is monotonic
    # in size, but with word-wrapping it is NOT — growing the font can break a line, DROP the block
    # width, and re-open a valid fit at a LARGER size. A tall balloon otherwise stops at the first
    # monotonic boundary and renders half-empty (e.g. "1858 เยนครับ" pinned at 29px in a 325px-tall
    # balloon that actually fits ~48px). Scan upward for the largest still-fitting size; the block
    # height only grows with the font, so stop once it clears the box (no larger size can fit) —
    # bounded, and a no-op for the wide/monotonic case (nothing larger fits → font unchanged).
    _wmax, _hmax = w_box * _FIT_MARGIN, h_box * _FIT_MARGIN
    _s = font + 1
    while _s <= high:
        _bw, _bh = measure(_s)
        if _bh > _hmax:
            break
        if _bw <= _wmax:
            font = _s
        _s += 1

    # #183 width-squeeze: narrow the column so the block fills the box HEIGHT (more lines) like
    # the original, instead of a few wide lines. Floor = the longest token's width at `font`,
    # so squeezing never force-breaks a word.
    min_w = max(1.0, min(_longest_word_w(font) + 4.0, float(mw)))

    def measure_h(w):
        lines, _ = text_render.calc_horizontal(
            font, text, max_width=int(w), max_height=10 ** 7, language=lang)
        return len(lines) * font * _LINE_HEIGHT

    used_w = squeeze_width(measure_h, mw, min_w, mh)
    lines, widths = text_render.calc_horizontal(
        font, text, max_width=int(used_w), max_height=10 ** 7, language=lang)
    block_w = max(widths) if widths else used_w
    block_h = len(lines) * font * _LINE_HEIGHT
    return font, float(block_w), float(block_h)


def _bubble_interior_box(region, bubble_box, crop_shape):
    """#179: the safe-interior box + anchor for narrow-column wrapping.

    When the balloon polygon is carried (#170 → crop coords), rasterize it and
    measure the distance-transform safe interior so English wraps to the bubble's
    true (narrow) shape, not its bounding box. Falls back to the centered bounding
    box when no polygon is present (== pre-#179 behaviour)."""
    bx1, by1, bx2, by2 = bubble_box
    poly = getattr(region, 'bubble_polygon', None)
    if poly:
        h, w = crop_shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)
        pts = np.array([[int(round(px)), int(round(py))] for px, py in poly], dtype=np.int32)
        cv2.fillPoly(mask, [pts], 1)
        iw, ih, anchor = safe_area_box(mask)
        if iw > 1 and ih > 1:
            return iw, ih, anchor
    return int(bx2 - bx1), int(by2 - by1), ((bx1 + bx2) / 2.0, (by1 + by2) / 2.0)


def _expand_single_axis(region, needed_count: int, used_count: int, horizontal_axis: bool):
    """If the wrapped translation needs more lines than the detection box has,
    scale the region's unrotated min-rect along the text's wrap axis to make
    room and return the rotated int64 dst_points; else None.

    Shared by the horizontal (rows → x-axis) and vertical (cols → y-axis)
    expansion, which previously carried byte-identical scale/rotate/except blocks
    differing only in the line-count source and which axis is scaled. The caller
    passes horizontal_axis explicitly (not inferred from region.horizontal) so
    the original two-independent-`if` behaviour is preserved exactly.
    """
    if not (needed_count > used_count and used_count > 0):
        return None
    scale_x = ((needed_count - used_count) / used_count) * 1 + 1
    xfact, yfact = (scale_x, 1.0) if horizontal_axis else (1.0, scale_x)
    try:
        poly = Polygon(region.unrotated_min_rect[0])
        minx, miny, maxx, maxy = poly.bounds
        poly = affinity.scale(poly, xfact=xfact, yfact=yfact, origin=(minx, miny))
        pts = np.array(poly.exterior.coords[:4])
        dst_points = rotate_polygons(
            region.center, pts.reshape(1, -1), -region.angle, to_int=False
        ).reshape(-1, 4, 2)
        return dst_points.astype(np.int64)
    except Exception:
        return None


def _region_territory(region):
    """The box a region 'owns' for anti-overlap: its balloon (#170) when its text FILLS it,
    else just its narrow detection/text box (#436 — a narration column must not reserve the
    whole balloon and over-clamp an overlapping neighbour). Returns None when no box is known."""
    xy = getattr(region, 'xyxy', None)
    if xy is None:
        return None
    bb = getattr(region, 'bubble_box', None)
    return region_territory_box(float(xy[0]), float(xy[1]), float(xy[2]), float(xy[3]), bb)


def _clean_layout_dst(region, img_shape, font_size_minimum: int, font_size_max: int, page_shape=None):
    """Render-layout rework: lay the translated text out as an upright horizontal block
    at a *small absolute* font, wrapped to a compact width, ready to be placed on the
    region's centre. Returns ``(font_size, block_w, block_h)`` — or ``None`` when the
    region has no detection box. Unlike the legacy path (which warps the English onto the
    original vertical-JP quad and stretches it tall/oversized), this fixes the font and
    builds the box to match, so the homography in ``render()`` is a plain scale.

    ``font_size_max`` (MIT_FONT_SIZE_MAX) sets the absolute font when >0, else a small
    page-scaled default (≈ MangaTranslator's 12–16px on a typical page)."""
    xy = getattr(region, 'xyxy', None)
    if xy is None:
        return None
    x1f, y1f, x2f, y2f = (float(v) for v in xy)
    # #175 patch-path fix: these three quantities are PAGE-relative — the font's
    # processing_scale (area→resolution), the wrap-width clamp (% of page width) and the
    # generous max-wrap-height. In the per-region patch path ``img_shape`` is the small CROP
    # (full-res but tiny area), which collapses processing_scale to its 0.5 floor → narration
    # rendered ~3× too small while balloon dialogue (box-driven) stayed normal. Use the PAGE
    # shape when the caller threads it; fall back to img_shape (full-page render → identical).
    ps_shape = page_shape if page_shape is not None else img_shape
    # #175: scale the clean-layout font by processing_scale so it tracks page resolution
    # (same look on the benchmark, larger on higher-res pages where the fixed px was too small).
    clean_fs_flat = clean_layout_font_size(font_size_max, ps_shape[0], ps_shape[1], font_size_minimum)
    # #175 follow-up: a big stylized DISPLAY caption ("LOVE IS FORBIDDEN" lettered at 96px) was
    # collapsing to the same flat ~26px as a 21px narration line. Size it near its ORIGINAL
    # lettering instead so it keeps its prominence; narration (orig <= flat) is byte-identical.
    clean_fs = clean_layout_target_fs(getattr(region, 'font_size', 0), clean_fs_flat)
    # Footprint width = the region's own (source-text) bbox width, so the English breaks
    # where the source columns did — a narration stays a narrow tall block, not a wide
    # paragraph. (The balloon box is deliberately NOT used: narration boxes also get a
    # wide bubble_box from segmentation, which would re-widen them.)
    wrap_w = clean_wrap_width(x2f - x1f, ps_shape[1])
    # A sized-up display caption wraps to its own (wider) source footprint, not the narrowed
    # narration column — otherwise the big glyphs break into a too-narrow column (mid-word
    # breaks). Narration keeps the narrow clean wrap.
    if clean_fs > clean_fs_flat:
        wrap_w = max(wrap_w, int(x2f - x1f))
    lang = getattr(region, 'target_lang', 'en_US')
    # #item9: never wrap narrower than the longest atomic word, or Thai/CJK words (no Latin
    # hyphenation) get force-split mid-word ("ข้างนอก"→"ข้า"/"งนอก"). Mirrors the guard
    # _bubble_fit_layout already applies; here it protects dialogue misrouted to clean-layout.
    _lw = text_render.longest_token_width(clean_fs, region.translation, lang)
    if _lw > wrap_w:
        wrap_w = int(_lw)
    # max_height is generous (full page) so wrapping is governed by width and the block
    # grows vertically — we place it on the centre regardless of the source box height.
    lines, widths = text_render.calc_horizontal(clean_fs, region.translation, wrap_w, int(ps_shape[0]), language=lang)
    # When a display caption was sized up, shrink it just enough that the wrapped block stays
    # within ~its original vertical footprint — keeps the caption prominent without spilling far
    # past where the source lettering sat. Never below the flat size (narration unaffected).
    if clean_fs > clean_fs_flat:
        # #430 Phase-3 hotfix: bound the sized-up caption on BOTH axes. The height-only
        # loop left a caption far WIDER than its source column, overflowing the art
        # (2026-07-02 One-Punch narration, fill_frac_w ~5x). Shrink while EITHER axis
        # exceeds its source-footprint tolerance; the longest-token floor keeps words whole
        # as the font shrinks, so this never re-introduces a mid-word break (item 9).
        max_h = (y2f - y1f) * _CLEAN_DISPLAY_H_TOL
        max_w = (x2f - x1f) * _CLEAN_DISPLAY_W_TOL
        while clean_fs > clean_fs_flat and (
            max(1, len(lines)) * clean_fs * _LINE_HEIGHT > max_h
            or (max(widths) if widths else 0) > max_w
        ):
            clean_fs -= 2
            lines, widths = text_render.calc_horizontal(clean_fs, region.translation, wrap_w, int(ps_shape[0]), language=lang)
    block_w = max(widths) if widths else wrap_w
    block_h = max(1, len(lines)) * clean_fs * _LINE_HEIGHT
    return int(clean_fs), float(block_w), float(block_h)


_REFERENCE_FILL_RATIO = 1.4  # #178: interior_w/det_w above this ⇒ text is a narrow column loose in a
# wide balloon (One-Punch 1.61–3.43) → don't fill; at/below ⇒ text fills its bubble (Thai 1.07–1.19)
# → fill. Grounded on measured fixtures; ~0.2 margin each side. See should_fill_demoted_bubble.


def should_fill_demoted_bubble(interior_w, det_w, threshold=_REFERENCE_FILL_RATIO):
    """A demoted-bubble region (has a balloon but was routed to clean-layout because the text fills
    <72% of the bubble width) should FILL the balloon only when the balloon interior isn't much wider
    than the text's own detection box. When the interior is ≫ the text (``interior_w/det_w > threshold``)
    the text is a narrow column loosely inside a wide balloon (or a loose detection) and must render as
    a narrow column, not blow up to fill the balloon. ``det_w <= 0`` → fill (avoid div-by-zero)."""
    if det_w <= 0:
        return True
    return (interior_w / det_w) <= threshold


def _reference_layout_intent(region, bubble_box, crop_shape, flat):
    """Resolve the whole reference-fit intent for a clean-layout region in ONE place — returns
    ``(box_w, box_h, (cx, cy), fill, cap)``. A single ``fill`` decision (:func:`should_fill_demoted_bubble`)
    drives BOTH the fit box and the font cap, so the invariant can't drift across two functions:

    - **fill** (a balloon whose text fills it): box = the distance-transform safe interior, cap = the
      interior height → the font grows to fill the balloon (like bubble-fit).
    - **non-fill** (no balloon, or a demoted narrow column loose in a wide balloon): box = the detection
      WIDTH with a generous vertical tolerance (``_CLEAN_DISPLAY_H_TOL``) so the font stays at the flat
      design size and wraps to MORE LINES instead of the tight detection height squeezing it tiny (the
      2026-07-02 over-shrink); cap = the flat page-scaled size. Width stays bounded to the detection box.
    """
    x1, y1, x2, y2 = (float(v) for v in region.xyxy)
    if bubble_box is not None:
        iw, ih, anchor = _bubble_interior_box(region, bubble_box, crop_shape)
        if should_fill_demoted_bubble(iw, x2 - x1):
            return float(iw), float(ih), anchor, True, int(ih)
    return ((x2 - x1), (y2 - y1) * _CLEAN_DISPLAY_H_TOL,
            ((x1 + x2) / 2.0, (y1 + y2) / 2.0), False, int(flat))


def _reference_clean_layout(region, box_w, box_h, font_size_minimum, cap, page_w):
    """#178 Phase-4 reference fit: binary-search the font to fill the given SAFE-BOX on BOTH axes.

    Unlike ``_clean_layout_dst`` (which sizes to the source-text column and can over/under-shrink),
    this wraps to the ``box_w`` of the balloon's safe interior (the reference model's bound) and
    shrinks the font from ``cap`` down to the largest that fits both axes, keeping words whole
    (longest-token floor → no item-9 mid-word break). Returns ``(font, block_w, block_h)``.
    """
    lang = getattr(region, 'target_lang', 'en_US')
    text = region.translation or ''

    def _wrap_at(fs):
        # never wrap narrower than the widest atomic word, so shrinking the font (not force-wrap)
        # is what makes an over-wide word fit — words stay whole in every language.
        lw = text_render.longest_token_width(fs, text, lang)
        w = max(int(box_w), int(lw))
        lines, widths = text_render.calc_horizontal(fs, text, w, int(page_w), language=lang)
        block_w = max(widths) if widths else 0.0
        block_h = max(1, len(lines)) * fs * _LINE_HEIGHT
        return block_w, block_h

    fs = fit_to_box(_wrap_at, float(box_w), float(box_h), int(cap), max(1, int(font_size_minimum)))
    block_w, block_h = _wrap_at(fs)
    return int(fs), float(block_w), float(block_h)


def resize_regions_to_font_size(img: np.ndarray, text_regions: List['TextBlock'], font_size_fixed: int, font_size_offset: int, font_size_minimum: int, bubble_fit: bool = False, font_max_box_ratio: float = _MAX_FONT_BOX_RATIO, anti_overlap: bool = False, font_size_max: int = 0, clean_layout: bool = False, page_shape=None, reference_layout: bool = False):
    """
    Adjust text region size to accommodate font size and translated text length.
    
    Args:  
        img: Input image
        text_regions: List of text regions to process
        font_size_fixed: Fixed font size (overrides other font parameters)
        font_size_offset: Font size offset
        font_size_minimum: Minimum font size (-1 for auto-calculation)

    Returns:  
        List of adjusted text region bounding boxes
    """    
    
    # Define minimum font size
    if font_size_minimum == -1:  
        font_size_minimum = round((img.shape[0] + img.shape[1]) / 200)  
    # logger.debug(f'font_size_minimum {font_size_minimum}')  
    font_size_minimum = max(1, font_size_minimum)  

    # #166: a fitted region is rendered into its *whole* balloon, so only the
    # sole occupant of a balloon may be fitted — two regions sharing one balloon
    # would otherwise stack on the same rect.
    occupancy = (balloon_occupancy([getattr(r, 'bubble_box', None) for r in text_regions])
                 if bubble_fit else None)

    # #436 de-dup: the SFX detector can re-detect a stylized word the line detector already
    # captured (e.g. "ปาร์ตี้" sitting inside "…จัดปาร์ตี้ดื่ม…"), yielding a small duplicate
    # region mostly inside the full-sentence region — it then renders on top of the sentence.
    # Blank the shorter duplicate when its text is a substring AND its box is ≥60% inside the
    # other's (containment + substring, never length alone, so a legitimate repeat survives).
    _orig_tr = [(r.translation or '').strip() for r in text_regions]
    for i, ri in enumerate(text_regions):
        ti = _orig_tr[i]
        if not ti:
            continue
        for j in range(len(text_regions)):
            if i == j:
                continue
            tj = _orig_tr[j]
            if tj and len(ti) < len(tj) and ti in tj \
                    and box_containment(ri.xyxy, text_regions[j].xyxy) >= 0.6:
                ri.translation = ''
                break

    dst_points_list = []
    # item-2 measurement (#430): env-gated per-region sizing trace. Off → no import, no work,
    # byte-identical render (render golden asserts it). One JSONL record per region, emitted at
    # EVERY exit including the three early `continue`s (missing those would drop the sole/shared/
    # clean regions from the sample). Analysis is the pure sizing_trace module, run offline.
    _trace_path = os.environ.get('MIT_SIZING_TRACE')
    if _trace_path:
        import json as _json
        from .sizing_trace import fill_fraction as _fill_fraction
        from .sizing_trace import axis_fill as _axis_fill
        from .sizing_trace import overflow_axes as _overflow_axes

        def _emit_trace(rec):
            # area occupancy (under-fill classifier) + per-axis fill & overflow (#462 guard).
            rec['fill_frac'] = _fill_fraction(rec['block_w'], rec['block_h'], rec['avail_w'], rec['avail_h'])
            rec['fill_frac_w'] = _axis_fill(rec['block_w'], rec['avail_w'])
            rec['fill_frac_h'] = _axis_fill(rec['block_h'], rec['avail_h'])
            rec['overflow_w'], rec['overflow_h'] = _overflow_axes(
                rec['block_w'], rec['block_h'], rec['avail_w'], rec['avail_h'])
            with open(_trace_path, 'a', encoding='utf-8') as _f:
                _f.write(_json.dumps(rec) + '\n')
    else:
        _emit_trace = None
    for i, region in enumerate(text_regions):
        _orig_fs = getattr(region, 'font_size', 0)  # #430: snapshot BEFORE any branch overwrites it
        _occ = int(occupancy[i]) if occupancy is not None else 1  # #430 trace: occupancy is None when bubble_fit off

        # #166 binary-search fit: when this region is the sole occupant of a known
        # balloon, size the font to fill the balloon box and render into that box.
        # This is the final word — it bypasses the length-ratio heuristic below so
        # the fitted size is never re-inflated past the balloon it was just fit to.
        # Only for horizontal targets (the wrapper measures horizontally); vertical,
        # balloon-less, and balloon-sharing regions fall through to legacy unchanged.
        bubble_box = getattr(region, 'bubble_box', None) if bubble_fit else None
        # #175 residual #2: only FILL the balloon for dialogue — a region whose own text
        # footprint spans most of the balloon width. A caption/narration loosely placed in a
        # large detected box (rw/bw low, e.g. One-Punch "THIS BRAT…") must fall through to
        # clean-layout's narrow source-referenced column instead of ballooning up to fill.
        _fills = True
        _fills_ratio = None  # #430 trace: retain the raw ratio (fills_bubble_width returns only a bool)
        if bubble_box is not None:
            _rx = region.xyxy
            _rw = float(_rx[2]) - float(_rx[0])
            _bw2 = float(bubble_box[2]) - float(bubble_box[0])
            _fills_ratio = None if _bw2 <= 0 else _rw / _bw2
            _fills = fills_bubble_width(_rw, _bw2)
        if (bubble_box is not None and _fills and region.horizontal and occupancy[i] == 1
                and region.translation and region.translation.strip()):
            # #179: wrap to the balloon's safe *interior* (narrow column) centered
            # on the safe anchor, not the full bounding box.
            fit_w, fit_h, (acx, acy) = _bubble_interior_box(region, bubble_box, img.shape)
            # anti-overlap: clamp the fit box so it can't grow into a neighbouring
            # region's territory; the font is then fit to the clamped box, so the text
            # stays in its own space instead of colliding with the next bubble.
            if anti_overlap:
                territories = [t for j, r in enumerate(text_regions) if j != i
                               for t in (_region_territory(r),) if t is not None]
                cb = clamp_box_to_neighbors(
                    (acx - fit_w / 2.0, acy - fit_h / 2.0, acx + fit_w / 2.0, acy + fit_h / 2.0),
                    territories, margin=2)
                cw, ch = cb[2] - cb[0], cb[3] - cb[1]
                if cw >= 6 and ch >= 6:
                    fit_w, fit_h = cw, ch
                    acx, acy = (cb[0] + cb[2]) / 2.0, (cb[1] + cb[3]) / 2.0
            # #430 SIMPLE-A: pass the balloon bbox width so a lone over-wide Thai word may use up to
            # it (capped) instead of the narrower safe-interior column; the safe-interior still bounds
            # wrapping/anchor. Only the sole-occupant path (its column IS the safe interior).
            region.font_size, _bw, _bh = _bubble_fit_layout(
                region, (fit_w, fit_h), img.shape, font_size_minimum,
                bubble_bbox_w=float(bubble_box[2] - bubble_box[0]))
            hw, hh = _bw / 2.0, _bh / 2.0
            dst_points_list.append(
                np.array([[[acx - hw, acy - hh], [acx + hw, acy - hh],
                           [acx + hw, acy + hh], [acx - hw, acy + hh]]], dtype=np.int64))
            if _emit_trace is not None:
                _emit_trace(dict(region_index=i, route='bubble_fit_sole', has_bubble=True,
                                 occupancy=_occ, fills_ratio=_fills_ratio, fills_threshold=0.72,
                                 orig_fs=_orig_fs, clean_fs_flat=None, final_fs=region.font_size,
                                 block_w=float(_bw), block_h=float(_bh), avail_w=float(fit_w), avail_h=float(fit_h),
                                 bubble_w=float(bubble_box[2] - bubble_box[0]),
                                 bubble_h=float(bubble_box[3] - bubble_box[1])))
            continue

        # #436: regions that SHARE one (often over-merged) balloon — occupancy > 1 — are not
        # the sole occupant, so the bubble-fit block above skipped them and they would render
        # tiny via clean-layout. Fill each to its OWN detection footprint instead, so
        # multi-balloon dialogue matches the source text size; each stays inside its own box,
        # clamped against its siblings, so they don't collide.
        if (bubble_box is not None and occupancy[i] > 1 and region.horizontal
                and region.translation and region.translation.strip()):
            x1f, y1f, x2f, y2f = (float(v) for v in region.xyxy)
            fit_w, fit_h = (x2f - x1f), (y2f - y1f)
            acx, acy = (x1f + x2f) / 2.0, (y1f + y2f) / 2.0
            if anti_overlap:
                territories = [t for j, r in enumerate(text_regions) if j != i
                               and (r.translation or '').strip()
                               for t in (_region_territory(r),) if t is not None]
                cb = clamp_box_to_neighbors(
                    (acx - fit_w / 2.0, acy - fit_h / 2.0, acx + fit_w / 2.0, acy + fit_h / 2.0),
                    territories, margin=2)
                cw, ch = cb[2] - cb[0], cb[3] - cb[1]
                if cw >= 6 and ch >= 6:
                    fit_w, fit_h = cw, ch
                    acx, acy = (cb[0] + cb[2]) / 2.0, (cb[1] + cb[3]) / 2.0
            region.font_size, _bw, _bh = _bubble_fit_layout(region, (fit_w, fit_h), img.shape, font_size_minimum)
            hw, hh = _bw / 2.0, _bh / 2.0
            dst_points_list.append(
                np.array([[[acx - hw, acy - hh], [acx + hw, acy - hh],
                           [acx + hw, acy + hh], [acx - hw, acy + hh]]], dtype=np.int64))
            if _emit_trace is not None:
                _emit_trace(dict(region_index=i, route='bubble_fit_shared', has_bubble=True,
                                 occupancy=_occ, fills_ratio=_fills_ratio, fills_threshold=0.72,
                                 orig_fs=_orig_fs, clean_fs_flat=None, final_fs=region.font_size,
                                 block_w=float(_bw), block_h=float(_bh), avail_w=float(fit_w), avail_h=float(fit_h)))
            continue

        # Clean horizontal layout (render-layout rework): for the regions the bubble-fit
        # block didn't claim — narration boxes, captions, vertical-JP columns — lay the
        # translated English out at a small absolute font in an upright box on the region's
        # centre, instead of warping it onto the original (often tall/vertical) detection
        # quad which stretches it oversized and overflowing. SFX is exempt (it keeps the big
        # stylized legacy path). Off → byte-identical.
        sfx = getattr(region, 'sfx_rescued', False)
        if clean_layout and not sfx and region.translation and region.translation.strip():
            x1f, y1f, x2f, y2f = (float(v) for v in region.xyxy)
            if reference_layout:
                # #178 Phase-4: fit against the balloon SAFE-BOX (or the detection box for narration),
                # binary-searching the font from the flat cap DOWN to the largest that fits both axes
                # — the reference model, replacing the source-column-referenced _clean_layout_dst.
                _ps = page_shape if page_shape is not None else img.shape
                _flat = clean_layout_font_size(font_size_max, _ps[0], _ps[1], font_size_minimum)
                _bw, _bh, (cx, cy), _fill, _cap = _reference_layout_intent(region, bubble_box, img.shape, _flat)
                clean_fs, block_w, block_h = _reference_clean_layout(
                    region, _bw, _bh, font_size_minimum, _cap, _ps[1])
                laid = (clean_fs, block_w, block_h)
            else:
                laid = _clean_layout_dst(region, img.shape, font_size_minimum, font_size_max, page_shape)
            if laid is not None:
                clean_fs, block_w, block_h = laid
                if not reference_layout:
                    cx, cy = (x1f + x2f) / 2.0, (y1f + y2f) / 2.0
                # anti-overlap: shift the upright block off any neighbour's territory.
                if anti_overlap:
                    territories = [t for j, r in enumerate(text_regions) if j != i
                                   for t in (_region_territory(r),) if t is not None]
                    cb = clamp_box_to_neighbors(
                        (cx - block_w / 2.0, cy - block_h / 2.0,
                         cx + block_w / 2.0, cy + block_h / 2.0), territories, margin=2)
                    if (cb[2] - cb[0]) >= 6 and (cb[3] - cb[1]) >= 6:
                        cx, cy = (cb[0] + cb[2]) / 2.0, (cb[1] + cb[3]) / 2.0
                region.font_size = clean_fs
                region._direction = 'h'
                dst_points_list.append(
                    np.array([centered_box(cx, cy, block_w, block_h)], dtype=np.int64))
                if _emit_trace is not None:
                    _ps = page_shape if page_shape is not None else img.shape
                    _flat = clean_layout_font_size(font_size_max, _ps[0], _ps[1], font_size_minimum)
                    _emit_trace(dict(region_index=i, route='clean_layout', has_bubble=bubble_box is not None,
                                     occupancy=_occ, fills_ratio=_fills_ratio, fills_threshold=0.72,
                                     orig_fs=_orig_fs, clean_fs_flat=_flat, final_fs=clean_fs,
                                     block_w=float(block_w), block_h=float(block_h),
                                     avail_w=float(x2f - x1f), avail_h=float(y2f - y1f)))
                continue

        # Store and validate original font size
        original_region_font_size = region.font_size
        if original_region_font_size <= 0:  
            # logger.warning(f"Invalid original font size ({original_region_font_size}) for text '{region.translation}'. Using default value {font_size_minimum}.")  
            original_region_font_size = font_size_minimum

        # Determine target font size
        current_base_font_size = original_region_font_size  
        if font_size_fixed is not None:  
            target_font_size = font_size_fixed  
        else:  
            target_font_size = current_base_font_size + font_size_offset  

        target_font_size = max(target_font_size, font_size_minimum, 1)  
        # print("-" * 50)
        # logger.debug(f"Calculated target font size: {target_font_size} for text '{region.translation}'")  

        # Single-axis text box expansion
        single_axis_expanded = False
        dst_points = None
        
        if region.horizontal:
            line_text_list, _ = text_render.calc_horizontal(
                region.font_size,
                region.translation,
                max_width=region.unrotated_size[0],
                max_height=region.unrotated_size[1],
                language=getattr(region, "target_lang", "en_US")
            )
            expanded = _expand_single_axis(region, len(line_text_list), len(region.texts), True)
            if expanded is not None:
                dst_points = expanded
                single_axis_expanded = True

        if region.vertical:
            line_text_list, _ = text_render.calc_vertical(
                region.font_size,
                region.translation,
                max_height=region.unrotated_size[1],
            )
            expanded = _expand_single_axis(region, len(line_text_list), len(region.texts), False)
            if expanded is not None:
                dst_points = expanded
                single_axis_expanded = True

        # If single-axis expansion failed, use general scaling
        if not single_axis_expanded:
            # Calculate scaling factor based on text length ratio
            orig_text = getattr(region, "text_raw", region.text)
            char_count_orig = count_text_length(orig_text)
            char_count_trans = count_text_length(region.translation.strip())     
            length_ratio = 1.0

            if char_count_orig > 0 and char_count_trans > char_count_orig:
                increase_percentage = (char_count_trans - char_count_orig) / char_count_orig
                font_increase_ratio = 1 + (increase_percentage * _LEN_RATIO_FONT_GAIN)
                font_increase_ratio = min(1.5, max(1.0, font_increase_ratio))
                target_font_size = int(target_font_size * font_increase_ratio)
                # Need greater bounding box scaling for the larger font + longer text
                target_scale = max(1, min(1 + increase_percentage * _LEN_RATIO_FONT_GAIN, 2))
            else:
                target_scale = 1

            # Cap narration/caption font (SFX exempt) BEFORE the box scaling, so the
            # box scales to the capped font instead of an oversized block overflowing
            # the panel. 0 → no cap (byte-identical).
            # #431: only a FREE-FLOATING SFX (no balloon) is exempt from the cap / box-scale
            # clamp. A balloon-associated region flagged sfx_rescued by the length heuristic
            # is dialogue ("DRINKING PARTY") — cap it so it can't oversize and overflow.
            disp = display_sfx(getattr(region, 'sfx_rescued', False),
                               getattr(region, 'is_sfx', False),
                               getattr(region, 'bubble_box', None) is not None)
            target_font_size = apply_font_cap(
                target_font_size, font_size_max, disp)

            # Calculate final scaling factor
            font_size_scale = (((target_font_size - original_region_font_size) / original_region_font_size) * _FONT_SIZE_SCALE_GAIN + 1) if original_region_font_size > 0 else 1.0
            final_scale = max(font_size_scale, target_scale)
            final_scale = max(1, min(final_scale, _MAX_BBOX_SCALE))
            # When a font cap is set, also stop the length-ratio box scaling from
            # enlarging a non-SFX region's box (the homography would warp the capped
            # font back up to fill it). The longer translation then wraps inside the
            # source box (narrow-column) instead of overflowing the panel.
            if font_size_max and font_size_max > 0 and not disp:
                final_scale = 1.0

            # Scale bounding box if needed
            if final_scale > 1.001:  
                # logger.debug(f"Scaling bounding box: text='{region.translation}', scale={final_scale:.2f}")  
                try:  
                    poly = Polygon(region.unrotated_min_rect[0])  
                     # Scale from the center  
                    poly = affinity.scale(poly, xfact=final_scale, yfact=final_scale, origin='center')  
                    scaled_unrotated_points = np.array(poly.exterior.coords[:4])  

                    dst_points = rotate_polygons(region.center, scaled_unrotated_points.reshape(1, -1), -region.angle, to_int=False).reshape(-1, 4, 2)  
                    # 移除边界限制，允许文本超出检测框边界
                    # dst_points[..., 0] = dst_points[..., 0].clip(0, img.shape[1] - 1)  
                    # dst_points[..., 1] = dst_points[..., 1].clip(0, img.shape[0] - 1)  
                    dst_points = dst_points.astype(np.int64)  
                    dst_points = dst_points.reshape((-1, 4, 2))  
                    # logger.debug(f"Finished calculating scaled dst_points.")  

                except Exception as e:  
                    # logger.error(f"Error during scaling for text '{region.translation}': {e}. Using original min_rect.")  
                    dst_points = region.min_rect
            else:
                dst_points = region.min_rect

        # #183: when render parity is on, clamp the legacy dst to image bounds so
        # text may exceed the detection box but never render off the page (the
        # commented-out clip let off-canvas text be silently dropped, #bug-hunt).
        # bubble_fit off → unchanged (byte-identical).
        if bubble_fit and isinstance(dst_points, np.ndarray):
            dst_points = np.clip(
                dst_points, np.array([0, 0]),
                np.array([img.shape[1] - 1, img.shape[0] - 1]))

        # anti-overlap: clamp the (possibly expanded) render box against the other
        # regions' territories so the warped text can't grow into the next
        # bubble/caption. The text is homography-warped into dst_points, so a smaller
        # box → smaller text that stays in its own space. Off → unchanged.
        if anti_overlap and isinstance(dst_points, np.ndarray):
            pts = dst_points.reshape(-1, 2)
            ax1, ay1 = float(pts[:, 0].min()), float(pts[:, 1].min())
            ax2, ay2 = float(pts[:, 0].max()), float(pts[:, 1].max())
            territories = [t for j, r in enumerate(text_regions) if j != i
                           for t in (_region_territory(r),) if t is not None]
            cb = clamp_box_to_neighbors((ax1, ay1, ax2, ay2), territories, margin=2)
            if ((cb[2] - cb[0]) >= 6 and (cb[3] - cb[1]) >= 6 and
                    (cb[0] > ax1 + 0.5 or cb[1] > ay1 + 0.5
                     or cb[2] < ax2 - 0.5 or cb[3] < ay2 - 0.5)):
                dst_points = np.array([[[cb[0], cb[1]], [cb[2], cb[1]],
                                        [cb[2], cb[3]], [cb[0], cb[3]]]], dtype=np.int64)

        # Store results and update font size
        dst_points_list.append(dst_points)
        region.font_size = int(target_font_size)
        if _emit_trace is not None:
            _lx = region.xyxy
            if isinstance(dst_points, np.ndarray):
                _p = dst_points.reshape(-1, 2)
                _blk_w = float(_p[:, 0].max() - _p[:, 0].min())
                _blk_h = float(_p[:, 1].max() - _p[:, 1].min())
            else:
                _blk_w = _blk_h = 0.0
            _emit_trace(dict(region_index=i, route='legacy', has_bubble=bubble_box is not None,
                             occupancy=int(occupancy[i]), fills_ratio=_fills_ratio, fills_threshold=0.72,
                             orig_fs=_orig_fs, clean_fs_flat=None, final_fs=int(target_font_size),
                             block_w=_blk_w, block_h=_blk_h,
                             avail_w=float(_lx[2]) - float(_lx[0]), avail_h=float(_lx[3]) - float(_lx[1])))

    return dst_points_list

async def dispatch(
    img: np.ndarray,
    text_regions: List[TextBlock],
    font_path: str = '',
    font_size_fixed: int = None,
    font_size_offset: int = 0,
    font_size_minimum: int = 0,
    hyphenate: bool = True,
    render_mask: np.ndarray = None,
    line_spacing: int = None,
    disable_font_border: bool = False,
    bubble_fit: bool = False,
    supersampling: int = 1,
    font_max_box_ratio: float = _MAX_FONT_BOX_RATIO,
    anti_overlap: bool = False,
    font_size_max: int = 0,
    clean_layout: bool = False,
    page_shape=None,
    reference_layout: bool = False
    ) -> np.ndarray:

    text_render.set_font(font_path)
    text_regions = list(filter(lambda region: region.translation, text_regions))

    # Resize regions that are too small. `page_shape` (full-page H,W) is threaded so clean-layout
    # narration scales by page resolution even when `img` is a per-region crop (#175 patch-path).
    dst_points_list = resize_regions_to_font_size(img, text_regions, font_size_fixed, font_size_offset, font_size_minimum, bubble_fit, font_max_box_ratio, anti_overlap, font_size_max, clean_layout, page_shape, reference_layout)

    # TODO: Maybe remove intersections

    # Render text
    for region, dst_points in tqdm(zip(text_regions, dst_points_list), '[render]', total=len(text_regions)):
        if render_mask is not None:
            # set render_mask to 1 for the region that is inside dst_points
            cv2.fillConvexPoly(render_mask, dst_points.astype(np.int32), 1)
        img = render(img, region, dst_points, hyphenate, line_spacing, disable_font_border, supersampling)
    return img

def _pad_box(temp_box, pad_height: bool, ext: int, offset: int):
    """Place temp_box inside a zero-padded RGBA box to reach the target aspect
    ratio. ext < 0 means no padding is possible → return temp_box.copy().
    pad_height selects the padded axis: True pads rows (height) by 2*ext and
    places temp_box at [offset:offset+h, :]; False pads columns (width) and
    places it at [:, offset:offset+w].

    Shared by render()'s four h/v ratio-padding branches, which differ only in
    axis, the per-branch ext formula, and the offset — horizontal text centres
    on the padded axis, vertical text top-/left-aligns (per #110). Those
    divergent choices stay explicit at the call sites; only the
    zero-box/place/copy boilerplate is folded here.
    """
    h, w = temp_box.shape[:2]
    if ext < 0:
        return temp_box.copy()
    if pad_height:
        box = np.zeros((h + ext * 2, w, 4), dtype=np.uint8)
        box[offset:offset + h, 0:w] = temp_box
    else:
        box = np.zeros((h, w + ext * 2, 4), dtype=np.uint8)
        box[0:h, offset:offset + w] = temp_box
    return box


def render(
    img,
    region: TextBlock,
    dst_points,
    hyphenate,
    line_spacing,
    disable_font_border,
    supersampling: int = 1
):
    # #181: render the text canvas at `ss`× then downscale → crisp glyphs +
    # controlled weight (ss=1 → byte-identical).
    ss = max(1, int(supersampling))
    fg, bg = region.get_font_colors()
    fg, bg = fg_bg_compare(fg, bg)

    if disable_font_border :
        bg = None

    middle_pts = (dst_points[:, [1, 2, 3, 0]] + dst_points) / 2
    norm_h = np.linalg.norm(middle_pts[:, 1] - middle_pts[:, 3], axis=1)
    norm_v = np.linalg.norm(middle_pts[:, 2] - middle_pts[:, 0], axis=1)
    r_orig = np.mean(norm_h / norm_v)

    # If configuration is set to non-automatic mode, use configuration to determine direction directly
    forced_direction = region._direction if hasattr(region, "_direction") else region.direction
    if forced_direction != "auto":
        if forced_direction in ["horizontal", "h"]:
            render_horizontally = True
        elif forced_direction in ["vertical", "v"]:
            render_horizontally = False
        else:
            render_horizontally = region.horizontal
    else:
        render_horizontally = region.horizontal

    #print(f"Region text: {region.text}, forced_direction: {forced_direction}, render_horizontally: {render_horizontally}")

    if render_horizontally:
        # #item9 ss-rounding: the renderer RE-WRAPS the laid-out text at the supersampled scale.
        # round(norm_h*ss) can land a pixel below the widest atomic word at font*ss and force-split
        # a Thai/CJK word mid-cluster ("ทำอาหาร"→"ทำอา"/"หาร") — undoing the layout's ss=1 word-floor
        # (p19). Floor the supersampled column at the longest token's width at the SAME scale so the
        # re-wrap can never split a word the layout meant to keep whole. Latin floor ≤ box → no-op.
        _render_text = region.get_translation_for_rendering()
        _wrap_w_ss = max(round(norm_h[0] * ss),
                         text_render.longest_token_width(region.font_size * ss, _render_text, region.target_lang))
        temp_box = text_render.put_text_horizontal(
            region.font_size * ss,
            _render_text,
            _wrap_w_ss,
            round(norm_v[0] * ss),
            region.alignment,
            region.direction == 'hl',
            fg,
            bg,
            region.target_lang,
            hyphenate,
            line_spacing,
        )
    else:
        temp_box = text_render.put_text_vertical(
            region.font_size * ss,
            region.get_translation_for_rendering(),
            round(norm_v[0] * ss),
            region.alignment,
            fg,
            bg,
            line_spacing,
        )
    # #436 de-dup: a region the pre-pass blanked (its translation was a duplicate substring of a
    # neighbour, e.g. the SFX-detected "ปาร์ตี้" inside "…จัดปาร์ตี้…") survives the line-529 filter
    # (it ran before the blanking) and still reaches here with empty text — put_text returns None.
    # Render nothing for it (the duplicate is meant to be dropped) instead of crashing on .shape.
    if temp_box is None:
        return img
    if ss > 1:
        temp_box = cv2.resize(
            temp_box,
            (max(1, temp_box.shape[1] // ss), max(1, temp_box.shape[0] // ss)),
            interpolation=cv2.INTER_AREA,
        )
    h, w, _ = temp_box.shape
    r_temp = w / h

    # Extend temporary box to the original aspect ratio (#110 R-1: use the
    # effective render direction, not the raw detected orientation). Each branch
    # picks its own ext formula + placement offset (h centres, v top-/left-aligns).
    if render_horizontally:
        if r_temp > r_orig:
            h_ext = int((w / r_orig - h) // 2) if r_orig > 0 else 0
            box = _pad_box(temp_box, True, h_ext, h_ext)
        else:
            w_ext = int((h * r_orig - w) // 2)
            box = _pad_box(temp_box, False, w_ext, 0)
    else:
        if r_temp > r_orig:
            h_ext = int(w / (2 * r_orig) - h / 2) if r_orig > 0 else 0
            box = _pad_box(temp_box, True, h_ext, 0)
        else:
            w_ext = int((h * r_orig - w) / 2)
            box = _pad_box(temp_box, False, w_ext, w_ext)

    src_points = np.array([[0, 0], [box.shape[1], 0], [box.shape[1], box.shape[0]], [0, box.shape[0]]]).astype(np.float32)
    #src_pts[:, 0] = np.clip(np.round(src_pts[:, 0]), 0, enlarged_w * 2)
    #src_pts[:, 1] = np.clip(np.round(src_pts[:, 1]), 0, enlarged_h * 2)

    M, _ = cv2.findHomography(src_points, dst_points, cv2.RANSAC, 5.0)
    if M is None:  # degenerate/collinear dst_points (#110 R-2)
        logger.debug('findHomography returned None (degenerate region), skipping warp')
        return img
    rgba_region = cv2.warpPerspective(box, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    x, y, w, h = cv2.boundingRect(dst_points.astype(np.int32))
    x0 = max(0, x)
    y0 = max(0, y)
    x1 = min(img.shape[1], x + w)
    y1 = min(img.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return img

    canvas_region = rgba_region[y0:y1, x0:x1, :3]
    mask_region = rgba_region[y0:y1, x0:x1, 3:4].astype(np.float32) / 255.0
    img[y0:y1, x0:x1] = np.clip(
        (img[y0:y1, x0:x1].astype(np.float32) * (1 - mask_region) + canvas_region.astype(np.float32) * mask_region),
        0,
        255,
    ).astype(np.uint8)
    return img

async def dispatch_eng_render(img_canvas: np.ndarray, original_img: np.ndarray, text_regions: List[TextBlock], font_path: str = '', line_spacing: int = 0, disable_font_border: bool = False) -> np.ndarray:
    if len(text_regions) == 0:
        return img_canvas

    if not font_path:
        font_path = os.path.join(BASE_PATH, 'fonts/comic shanns 2.ttf')
    text_render.set_font(font_path)

    return render_textblock_list_eng(img_canvas, text_regions, line_spacing=line_spacing, size_tol=1.2, original_img=original_img, downscale_constraint=0.8,disable_font_border=disable_font_border)

async def dispatch_eng_render_pillow(img_canvas: np.ndarray, original_img: np.ndarray, text_regions: List[TextBlock], font_path: str = '', line_spacing: int = 0, disable_font_border: bool = False) -> np.ndarray:
    if len(text_regions) == 0:
        return img_canvas

    if not font_path:
        font_path = os.path.join(BASE_PATH, 'fonts/NotoSansMonoCJK-VF.ttf.ttc')
    text_render.set_font(font_path)

    return render_textblock_list_eng_pillow(font_path, img_canvas, text_regions, original_img=original_img, downscale_constraint=0.95)
