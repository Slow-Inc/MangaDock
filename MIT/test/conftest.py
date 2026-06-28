import importlib.util

import pytest


# #359 — the lightweight CI "logic gate": when the heavy ML stack (torch) is NOT installed,
# skip the test modules that import torch/transformers/diffusers — directly (model forward /
# flux inpainter / translators) or transitively (the pipeline + dispatch registries + the
# `pipeline_params -> ModelWrapper` top-import). That lets the torch-free logic suite collect
# without ImportError, so `mit-ci`'s logic job can run on a lightweight install and be a real
# blocking gate. With torch present (local dev, or the heavy CI job) nothing is ignored and the
# FULL suite runs. The list was derived by collecting under a torch-absent import blocker — keep
# it in sync when a new heavy test is added (a new heavy test surfaces as a collection error in
# the logic job, which is the signal to add it here).
def _has_torch() -> bool:
    try:
        return importlib.util.find_spec('torch') is not None
    except Exception:
        return False


_HEAVY_TESTS = [
    'test_async_correctness.py',     # test bodies import the pipeline (torch) at runtime
    'test_batch_preprocess.py',
    'test_det_forward_default.py',
    'test_flux_klein_inpainter.py',
    'test_gpt_samples.py',
    'test_page_context.py',
    'test_pipeline_orchestrator.py',
    'test_pipeline_params.py',
    'test_prev_context_prompt.py',   # test body imports translators.config_gpt -> translators/__init__ (torch)
    'test_registry_trim.py',
    'test_stages.py',
    'test_translation.py',
    'test_translation_manual.py',
    'test_worker_bind.py',
]
collect_ignore = [] if _has_torch() else list(_HEAVY_TESTS)


# https://docs.pytest.org/en/6.2.x/example/simple.html?highlight=addoption#pass-different-values-to-a-test-function-depending-on-command-line-options
def pytest_addoption(parser):
    parser.addoption('--translator', action='store', default=None, help='Chosen translator for test run')
    parser.addoption('--target-lang', action='store', default='ENG', help='Target language for translator test run')
    parser.addoption('--text', action='store', default=None, help='Text to be used for translation test run')
    parser.addoption('--count', action='store', type=int, default=1, help='Amount of times the test should be repeated')

@pytest.fixture
def translator(request):
    return request.config.getoption('--translator')

@pytest.fixture
def tgt_lang(request):
    return request.config.getoption('--target-lang')
    
@pytest.fixture
def text(request):
    return request.config.getoption('--text')

@pytest.fixture
def count(request):
    return request.config.getoption('--count')
