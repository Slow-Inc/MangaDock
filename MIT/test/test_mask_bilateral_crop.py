"""#822: complete_mask bilateral-filtered the whole (resized) page, ~0.6 s, but only reads the
filtered image inside each textline's rect. Filtering each rect with an 8 px margin (the filter's
radius at d=17) gives the same pixels there — identical output, a fraction of the work."""
import cv2
import numpy as np

from manga_translator.mask_refinement.text_mask_utils import bilateral_region


def test_a_filtered_region_equals_the_same_region_of_the_filtered_page():
    rng = np.random.default_rng(7)
    img = rng.integers(0, 256, size=(300, 420, 3), dtype=np.uint8)
    full = cv2.bilateralFilter(img, 17, 80, 80)
    for (x, y, w, h) in [(50, 60, 120, 40), (0, 0, 30, 30), (400, 280, 20, 20), (200, 0, 220, 300)]:
        assert np.array_equal(bilateral_region(img, x, y, w, h), full[y:y + h, x:x + w]), (x, y, w, h)


def test_component_assignment_matches_the_all_pairs_computation_872():
    """#872 profile: complete_mask ran shapely area/intersection/distance/centroid for every
    (connected component x textline) pair — 1.2 s over 4 pages. _component_textline skips the
    intersection of disjoint boxes (area exactly 0) and computes distances only when no overlap clears
    the threshold; it must pick the same textline (or skip) as the all-pairs version."""
    import random
    from types import SimpleNamespace
    from shapely.geometry import Polygon
    from manga_translator.mask_refinement.text_mask_utils import _component_textline

    def brute(x1, y1, w1, h1, area1, polys, lines, keep_threshold=1e-2):
        cc = Polygon([[x1, y1], [x1 + w1, y1], [x1 + w1, y1 + h1], [x1, y1 + h1]])
        ratio = np.zeros(len(polys), dtype=np.float32)
        dist = np.zeros(len(polys), dtype=np.float32)
        for t, p in enumerate(polys):
            ratio[t] = p.intersection(cc).area / min(area1, p.area)
            dist[t] = p.distance(cc.centroid)
        avg = int(np.argmax(ratio))
        if area1 >= polys[avg].area:
            return None
        if ratio[avg] <= keep_threshold:
            avg = int(np.argmin(dist))
            unit = max(min([lines[avg].font_size, w1, h1]), 10)
            if dist[avg] >= 0.5 * unit:
                return None
        return avg

    rnd = random.Random(3)
    for _ in range(300):
        polys, lines = [], []
        for _ in range(rnd.randint(1, 9)):
            x, y, w, h = rnd.randint(0, 500), rnd.randint(0, 500), rnd.randint(10, 160), rnd.randint(10, 60)
            sk = rnd.randint(-6, 6)
            polys.append(Polygon([(x, y), (x + w, y + sk), (x + w, y + h + sk), (x, y + h)]))
            lines.append(SimpleNamespace(font_size=rnd.randint(8, 40)))
        x1, y1, w1, h1 = rnd.randint(0, 560), rnd.randint(0, 560), rnd.randint(2, 50), rnd.randint(2, 50)
        area1 = rnd.randint(10, w1 * h1 + 10)
        want = brute(x1, y1, w1, h1, area1, polys, lines)
        got = _component_textline(x1, y1, w1, h1, area1, polys, [p.area for p in polys],
                                  [p.bounds for p in polys], lines, 1e-2)
        assert got == want, (x1, y1, w1, h1, area1, got, want)
