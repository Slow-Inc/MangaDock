"""Page probes (#756): attribute each defect on a real page to the first stage it appears in.

The probes read a plain snapshot of a finished run (`PageSnapshot`) — built by
`tools/doctor_page.py` from the pipeline context — so they are pure and torch-free.

Attribution: stages are checked in pipeline order, and a region flagged by an earlier stage is
recorded as *inherited* by later ones instead of counting as a new defect. A stage's status
reflects only the defects rooted in it, so the report names where a problem starts rather than
every place it shows.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .report import FAIL, OK, WARN, DoctorRun, StageReport

Box = Tuple[float, float, float, float]

#: Adjacent-line spacing, in units of the smaller font size, that still reads as one block.
#: Measured on the 2026-10-20 caption page: in-box line gaps were 0.90–1.16, and the merge rule
#: only joins gaps < 1.0. Above ~1.6 lines are usually separate blocks.
NEAR_MISS_GAP = (1.0, 1.6)
#: Render may overshoot its container by this many px before it counts as a spill.
SPILL_TOLERANCE_PX = 4
#: Targets whose script is not Latin: Latin words left in their translation are suspicious.
NON_LATIN_TARGETS = {'THA', 'JPN', 'CHS', 'CHT', 'KOR', 'RUS', 'UKR', 'ARA', 'HIN'}
_LATIN_WORD = re.compile(r'[A-Za-z]{2,}')


@dataclass
class Region:
    index: int
    xyxy: Box
    text: str
    translation: str
    font_size: float
    bubble_idx: Optional[int] = None
    bubble_box: Optional[Box] = None
    render_branch: Optional[str] = None
    render_font_px: Optional[float] = None
    render_dst_box: Optional[Box] = None
    from_sfx: bool = False


@dataclass
class PageSnapshot:
    target_lang: str
    width: int
    height: int
    textlines: int
    sfx_lines: int
    empty_reads: int
    regions: List[Region] = field(default_factory=list)
    #: (source text, drop reason) for regions the post-translation filter removed
    dropped: List[Tuple[str, str]] = field(default_factory=list)


#: region index -> [(root stage, status), (later stage, 'inherited'), ...]
Flags = Dict[int, List[Tuple[str, str]]]


def _status(statuses: List[str]) -> str:
    return FAIL if FAIL in statuses else WARN if WARN in statuses else OK


def _flag(flags: Flags, idx: int, stage: str, status: str) -> bool:
    """Record a defect; return True when it is rooted here (not inherited)."""
    if idx in flags:
        if (stage, 'inherited') not in flags[idx]:
            flags[idx].append((stage, 'inherited'))
        return False
    flags[idx] = [(stage, status)]
    return True


def _chain(group: List[Region]) -> bool:
    """Do these regions read as consecutive lines of one block? (container_merge's rule)"""
    from manga_translator.container_merge import components_chain
    tall = all(r.xyxy[3] - r.xyxy[1] > 1.5 * (r.xyxy[2] - r.xyxy[0]) for r in group)
    return components_chain([{i} for i in range(len(group))], 'v' if tall else 'h',
                            [r.xyxy for r in group], [r.font_size for r in group])


def _line_count(r: Region) -> int:
    """Approximate lines in a region from its height (the payload carries no line list)."""
    return max(1, round((r.xyxy[3] - r.xyxy[1]) / max(1.0, r.font_size * 2.0)))


def _gap_ratio(upper: Region, lower: Region) -> float:
    return (lower.xyxy[1] - upper.xyxy[3]) / max(1.0, min(upper.font_size, lower.font_size))


def _probe_detect(page: PageSnapshot) -> StageReport:
    status = WARN if page.textlines == 0 else OK
    return StageReport('detect', status, {'textlines': page.textlines, 'sfx': page.sfx_lines},
                       'no text lines detected' if status == WARN else '')


def _probe_ocr(page: PageSnapshot) -> StageReport:
    ratio = page.empty_reads / page.textlines if page.textlines else 0.0
    status = WARN if ratio > 0.2 else OK
    return StageReport('ocr', status, {'empty_reads': page.empty_reads},
                       f'{ratio:.0%} of lines read empty' if status == WARN else '')


def _probe_merge(page: PageSnapshot, flags: Flags) -> StageReport:
    text_regions = [r for r in page.regions if not r.from_sfx]
    groups: Dict[int, List[Region]] = defaultdict(list)
    for r in text_regions:
        if r.bubble_idx is not None:
            groups[r.bubble_idx].append(r)
    multi = [sorted(g, key=lambda r: r.xyxy[1]) for g in groups.values() if len(g) > 1]
    # Only regions that chain as consecutive lines of one block can be a split — the same rule
    # container_merge (#757) uses; others are separate blocks under one polygon. Then a
    # single-line region proves a split, while all-multi-line regions are separate paragraphs.
    chained = [g for g in multi if _chain(g)]
    shared = [g for g in multi if g not in chained]
    split = [g for g in chained if any(_line_count(r) < 2 for r in g)]
    paragraphs = [g for g in chained if g not in split]
    evidence = []
    for kind, status, found in (('split', FAIL, split), ('paragraphs', WARN, paragraphs)):
        for g in found:
            for r in g:
                _flag(flags, r.index, 'merge', status)
            ratios = ', '.join(f'gap/char={_gap_ratio(a, b):.2f}' for a, b in zip(g, g[1:]))
            evidence.append(f'container {g[0].bubble_idx} {kind}: {len(g)} regions ({ratios})')

    near = 0
    for i, a in enumerate(text_regions):
        for b in text_regions[i + 1:]:
            if a.bubble_idx is not None and b.bubble_idx is not None:
                continue  # tagged: either the same container (handled above) or truly separate
            upper, lower = (a, b) if a.xyxy[1] <= b.xyxy[1] else (b, a)
            lo, hi = NEAR_MISS_GAP
            if not lo <= _gap_ratio(upper, lower) <= hi:
                continue
            overlap = min(upper.xyxy[2], lower.xyxy[2]) - max(upper.xyxy[0], lower.xyxy[0])
            narrow = min(upper.xyxy[2] - upper.xyxy[0], lower.xyxy[2] - lower.xyxy[0])
            sizes = sorted((upper.font_size, lower.font_size))
            if overlap < 0.5 * narrow or sizes[1] > 1.3 * sizes[0]:
                continue
            near += 1
            _flag(flags, upper.index, 'merge', WARN)
            _flag(flags, lower.index, 'merge', WARN)
            evidence.append(f'near-miss regions {upper.index}/{lower.index} '
                            f'gap/char={_gap_ratio(upper, lower):.2f}')

    status = FAIL if split else WARN if near or paragraphs else OK
    return StageReport('merge', status,
                       {'split_containers': len(split), 'split_regions': sum(len(g) for g in split),
                        'paragraph_containers': len(paragraphs), 'shared_containers': len(shared),
                        'near_miss_pairs': near},
                       '; '.join(evidence))


def _probe_translate(page: PageSnapshot, flags: Flags) -> StageReport:
    root, inherited, statuses, evidence = 0, 0, [], []
    empty = untranslated = latin = 0
    for r in page.regions:
        if r.from_sfx:
            continue
        out = (r.translation or '').strip()
        verdict = None
        if not out:
            empty += 1
            verdict = (FAIL, f'region {r.index} empty')
        elif out.upper() == r.text.strip().upper() and re.search(r'\w', out):
            untranslated += 1
            verdict = (WARN, f'region {r.index} untranslated')
        elif page.target_lang in NON_LATIN_TARGETS:
            # all-caps tokens of <= 3 letters are abbreviations ('IC', 'OK') kept on purpose
            words = [w for w in _LATIN_WORD.findall(out) if not (w.isupper() and len(w) <= 3)]
            if words:
                latin += 1
                verdict = (WARN, f'region {r.index} keeps Latin {words[:3]}')
        if verdict is None:
            continue
        if _flag(flags, r.index, 'translate', verdict[0]):
            root += 1
            statuses.append(verdict[0])
            evidence.append(verdict[1])
        else:
            inherited += 1
    return StageReport('translate', _status(statuses),
                       {'root': root, 'inherited': inherited, 'empty': empty,
                        'untranslated': untranslated, 'latin_in_target': latin},
                       '; '.join(evidence))


def _probe_render(page: PageSnapshot, flags: Flags) -> StageReport:
    root, inherited, statuses, evidence = 0, 0, [], []
    spill = small = suppressed = 0
    floor = max(10.0, 0.006 * page.height)
    for r in page.regions:
        verdict = None
        if r.render_branch == 'suppressed':
            suppressed += 1
            verdict = (WARN, f'region {r.index} suppressed')
        elif r.render_dst_box is not None and r.bubble_box is not None:
            d, c, t = r.render_dst_box, r.bubble_box, SPILL_TOLERANCE_PX
            if d[0] < c[0] - t or d[1] < c[1] - t or d[2] > c[2] + t or d[3] > c[3] + t:
                spill += 1
                verdict = (FAIL, f'region {r.index} spills out of its container')
        if verdict is None and r.render_font_px and r.render_font_px < floor and not r.from_sfx:
            small += 1
            verdict = (WARN, f'region {r.index} font {r.render_font_px:.0f}px < {floor:.0f}px')
        if verdict is None:
            continue
        if _flag(flags, r.index, 'render', verdict[0]):
            root += 1
            statuses.append(verdict[0])
            evidence.append(verdict[1])
        else:
            inherited += 1
    return StageReport('render', _status(statuses),
                       {'root': root, 'inherited': inherited, 'spill': spill, 'small_font': small,
                        'suppressed': suppressed},
                       '; '.join(evidence))


def _box(v) -> Optional[Box]:
    return tuple(float(x) for x in v) if v is not None else None


def snapshot_from_payload(payload: Dict, target_lang: str, *, textlines: int, sfx_lines: int,
                          empty_reads: int) -> PageSnapshot:
    """Build a snapshot from the production `/patches` payload (`text_layer.regions_payload`).

    Regions that share one `bubble_box` share a container; dropped regions are listed, not probed."""
    containers: Dict[Box, int] = {}
    regions, dropped = [], []
    for d in payload.get('regions', []):
        if not d.get('rendered', True) and 'drop_reason' in d:
            dropped.append((d.get('src', ''), d['drop_reason']))
            continue
        bubble = _box(d.get('bubble_box'))
        regions.append(Region(
            index=len(regions), xyxy=_box(d.get('xyxy')), text=d.get('src', ''),
            translation=d.get('dst', ''), font_size=float(d.get('font_src_px') or 0),
            bubble_idx=containers.setdefault(bubble, len(containers)) if bubble else None,
            bubble_box=bubble, render_branch=d.get('branch'),
            render_font_px=d.get('font_final_px'), render_dst_box=_box(d.get('dst_box'))))
    return PageSnapshot(target_lang=target_lang, width=payload.get('img_width', 0),
                        height=payload.get('img_height', 0), textlines=textlines,
                        sfx_lines=sfx_lines, empty_reads=empty_reads, regions=regions,
                        dropped=dropped)


def diagnose(page: PageSnapshot) -> Tuple[DoctorRun, Flags]:
    """Run every page probe in pipeline order; return the report and per-region flags."""
    flags: Flags = {}
    reports = [_probe_detect(page), _probe_ocr(page), _probe_merge(page, flags),
               _probe_translate(page, flags), _probe_render(page, flags)]
    return DoctorRun(reports), flags
