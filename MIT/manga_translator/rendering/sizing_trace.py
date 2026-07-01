"""Item-2 under-fill measurement (Phase 0, #430) — pure diagnostics, dependency-light.

Reads the raw per-region sizing facts the dispatcher dumps (env-gated `MIT_SIZING_TRACE`)
and classifies WHY a region under-fills its bubble, so the item-2 fix targets the measured
dominant cause instead of a guess. No PIL/torch imports — unit-testable in <1s.
"""


def fill_fraction(block_w, block_h, avail_w, avail_h):
    """Fraction of the available box that the rendered text block occupies (area ratio).

    A degenerate/undetected available box (area ≤ 0) yields 0.0 — unknown occupancy, never
    a divide-by-zero — so a record with no bubble/interior doesn't crash the classifier.
    """
    avail = avail_w * avail_h
    if avail <= 0:
        return 0.0
    return (block_w * block_h) / avail


def underfill_bucket(rec):
    """The gate that first prevented this region from filling its bubble — the fix-routing label.

    Precedence mirrors the dispatcher's decision tree (the earliest gate wins), so each label
    points at one actionable cause rather than a downstream symptom.
    """
    if not rec.get('has_bubble'):
        return 'no_bubble'
    if (rec.get('occupancy', 1) == 1 and rec.get('fills_ratio') is not None
            and rec['fills_ratio'] < rec.get('fills_threshold', 0.72)):
        return 'fills_demote'
    if rec.get('route') == 'bubble_fit_shared':
        return 'shared_fit_small'
    if rec.get('route') == 'bubble_fit_sole':
        return 'bubblefit_constrained'
    if rec.get('route') == 'clean_layout':
        # clean-layout grows for a large source caption (orig>flat) and only shrinks below it to
        # fit box height; so orig<=flat means the source itself was small (flat cap can't be blamed),
        # while orig>flat rendering small means the fit-to-height shrank it.
        if rec.get('orig_fs', 0) <= rec.get('clean_fs_flat', 0):
            return 'clean_flat_source_small'
        return 'clean_shrunk_to_fit'
    return 'filled'


def classify(records, underfill_threshold=0.5):
    """Tally the under-fill cause across records — ONLY the regions actually rendering small.

    A region counts as under-filled when its measured ``fill_frac`` (rendered block area /
    available area) is below ``underfill_threshold``; well-filled regions are excluded so
    healthy small captions can't dilute the dominant cause. Returns totals + a per-bucket
    tally of the under-filled regions.
    """
    under = [r for r in records if r.get('fill_frac', 0.0) < underfill_threshold]
    by_bucket = {}
    for r in under:
        b = underfill_bucket(r)
        by_bucket[b] = by_bucket.get(b, 0) + 1
    dominant, dominant_share = None, 0.0
    if under:
        dominant = max(by_bucket, key=by_bucket.get)
        dominant_share = by_bucket[dominant] / len(under)
    return {'total': len(records), 'underfilled': len(under), 'by_bucket': by_bucket,
            'dominant': dominant, 'dominant_share': dominant_share}
