"""#884: the 48px OCR model runs with cuDNN disabled on Windows — the one-line switch that made it
3-4x faster with identical reads. Torch is imported, so this file lives in the torch-heavy set."""
import pytest
torch = pytest.importorskip("torch")

from manga_translator.ocr import model_48px


def test_flags_follow_the_module_switch(monkeypatch):
    monkeypatch.setattr(model_48px, "_OCR_USE_CUDNN", False)
    with model_48px._cudnn_flags():
        assert torch.backends.cudnn.enabled is False


def test_flags_restore_cudnn_afterwards(monkeypatch):
    monkeypatch.setattr(model_48px, "_OCR_USE_CUDNN", False)
    with model_48px._cudnn_flags():
        pass
    assert torch.backends.cudnn.enabled is True


def test_switch_can_be_forced_back_on(monkeypatch):
    monkeypatch.setattr(model_48px, "_OCR_USE_CUDNN", True)
    with model_48px._cudnn_flags():
        assert torch.backends.cudnn.enabled is True
