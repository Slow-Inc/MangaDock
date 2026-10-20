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
