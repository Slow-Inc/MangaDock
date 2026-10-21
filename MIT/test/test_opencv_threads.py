"""#872: importing ultralytics runs cv2.setNumThreads(0) (a PyTorch-DataLoader workaround), which
leaves OpenCV single-threaded for the whole process — every bilateral filter, warp and resize in the
pipeline. Measured: the detector's page bilateral filter 0.64 s in the pipeline vs 0.05 s on 20
threads. MIT only runs inference, so the YOLO loaders give OpenCV its default threads back."""
import os
import sys
import types

import cv2
import pytest

from manga_translator.cv_threads import restore_opencv_threads


def test_restore_gives_opencv_its_default_threads():
    cv2.setNumThreads(0)
    restore_opencv_threads()
    assert cv2.getNumThreads() > 1 or os.cpu_count() == 1


@pytest.mark.parametrize('module', ['manga_translator.bubble_detector', 'manga_translator.sfx_detector'])
def test_the_yolo_loaders_undo_ultralytics_thread_setting(monkeypatch, module):
    import importlib
    fake = types.ModuleType('ultralytics')

    class YOLO:
        def __init__(self, path):
            self.path = path
    fake.YOLO = YOLO
    monkeypatch.setitem(sys.modules, 'ultralytics', fake)
    hub = types.ModuleType('huggingface_hub')
    hub.hf_hub_download = lambda repo_id, filename: 'model.pt'
    monkeypatch.setitem(sys.modules, 'huggingface_hub', hub)
    mod = importlib.import_module(module)
    monkeypatch.setattr(mod, '_model', None)
    cv2.setNumThreads(0)                       # what `import ultralytics` does
    mod._load()
    assert cv2.getNumThreads() > 1 or os.cpu_count() == 1
