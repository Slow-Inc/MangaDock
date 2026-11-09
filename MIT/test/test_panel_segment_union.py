"""#822 warm profile: panel Segment.union_all spent ~0.7 s/page in `s2 in used` (a list scanned with
__eq__, O(n^3) overall). A set of order-free endpoint keys has the same meaning — identical output."""
import random

from manga_translator.utils.panel.lib.segment import Segment


def _reference_union_all(segments):
    unioned = True
    while unioned:
        unioned = False
        dedup, used = [], []
        for i, s1 in enumerate(segments):
            for s2 in segments[i + 1:]:
                if s2 in used:
                    continue
                s3 = s1.union(s2)
                if s3 is not None:
                    unioned = True
                    dedup += [s3]
                    used.append(s1)
                    used.append(s2)
                    break
            if s1 not in used:
                dedup += [s1]
        segments = dedup
    return dedup


def test_union_all_matches_the_reference_on_random_page_like_segments():
    rng = random.Random(3)
    for _ in range(40):
        segs = []
        for _ in range(rng.randint(2, 40)):
            if rng.random() < 0.5:   # horizontal-ish gutters, often collinear and overlapping
                y = rng.choice([100, 300, 500]); x0 = rng.randint(0, 600)
                segs.append(Segment((x0, y + rng.randint(-2, 2)), (x0 + rng.randint(20, 300), y)))
            else:
                x = rng.choice([150, 400]); y0 = rng.randint(0, 800)
                segs.append(Segment((x, y0), (x + rng.randint(-2, 2), y0 + rng.randint(20, 300))))
        want = [(s.a, s.b) for s in _reference_union_all(list(segs))]
        got = [(s.a, s.b) for s in Segment.union_all(list(segs))]
        assert got == want


def test_cached_length_and_angle_match_their_formulas():
    """#822 follow-up: dist()/angle() are cached (union_all calls them per pair); the cache must
    return exactly what the formula does, on every call."""
    import math
    rnd = random.Random(7)
    for _ in range(500):
        a = (rnd.randint(0, 900), rnd.randint(0, 900))
        b = (rnd.randint(0, 900), rnd.randint(0, 900))
        s = Segment(a, b)
        dx, dy = abs(b[0] - a[0]), abs(b[1] - a[1])
        for _ in range(2):
            assert s.dist() == math.sqrt(dx ** 2 + dy ** 2)
            assert s.angle() == (math.atan(dy / dx) if dx != 0 else math.pi / 2)


def test_projected_point_matches_the_numpy_version():
    """#822 follow-up: projected_point ran on 2-element numpy arrays for every pair union_all and
    split compare; the plain-float version must return exactly the same dot."""
    import numpy as np

    def numpy_projected(seg, p):
        a, b, p = np.array(seg.a), np.array(seg.b), np.array(p)
        ap, ab = p - a, b - a
        if ab[0] == 0 and ab[1] == 0:
            return a
        r = a + np.dot(ap, ab) / np.dot(ab, ab) * ab
        return (round(r[0]), round(r[1]))

    rnd = random.Random(11)
    for _ in range(2000):
        seg = Segment((rnd.randint(0, 2000), rnd.randint(0, 2000)), (rnd.randint(0, 2000), rnd.randint(0, 2000)))
        p = (rnd.randint(-100, 2100), rnd.randint(-100, 2100))
        for q in (p, np.array([p]), np.array(p)):              # tuple, polygon dot [[x, y]], array
            got, want = seg.projected_point(q), numpy_projected(seg, q)
            assert tuple(int(v) for v in got) == tuple(int(v) for v in want), (seg, q, got, want)
    flat = Segment((5, 5), (5, 5))
    assert tuple(flat.projected_point((9, 9))) == (5, 5)
