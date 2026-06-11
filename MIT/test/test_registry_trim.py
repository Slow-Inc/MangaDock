"""Pin the #191 vendored-code removal.

The SD/LDM inpainter (vendored CompVis LDM ~11.7k LOC) and the ComicTextDetector
+ vendored YOLOv5 (GPL ~2.3k LOC) are gone from the enums + dispatch registries,
while every inpainter/detector the production path uses stays registered. The
MangaDock roadmap replaces these with diffusers/Flux + ultralytics YOLO, so the
removal is roadmap-aligned, not a capability loss.
"""
from manga_translator.config import Inpainter, Detector
from manga_translator.inpainting import INPAINTERS
from manga_translator.detection import DETECTORS


def test_sd_inpainter_removed():
    assert not hasattr(Inpainter, 'sd')
    assert 'sd' not in {i.value for i in Inpainter}
    assert 'sd' not in {k.value for k in INPAINTERS}


def test_ctd_detector_removed():
    assert not hasattr(Detector, 'ctd')
    assert 'ctd' not in {d.value for d in Detector}
    assert 'ctd' not in {k.value for k in DETECTORS}


def test_production_inpainters_intact():
    # lama_large is the production default (Backend buildMitConfig)
    kept = {'default', 'lama_large', 'lama_mpe', 'none', 'original'}
    assert {k.value for k in INPAINTERS} == kept


def test_production_detectors_intact():
    # default / dbconvnext are the production path (#170 det_bubble_seg)
    kept = {'default', 'dbconvnext', 'craft', 'paddle', 'none'}
    assert {k.value for k in DETECTORS} == kept
