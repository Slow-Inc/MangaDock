"""Pipeline construction globals (#187 seam S12, globals half).

`apply_global_settings` isolates the process-global side effects the constructor did
inline — the conditional `ModelWrapper._MODEL_DIR` override and the two
`torch.backends.*.allow_tf32 = True` flags. (The `PipelineParams` value object for the
~20 parsed fields is deferred until #192 centralises config, per the decomposition
analysis — it is entangled with device/`using_gpu`/raise ordering in the constructor.)
"""
import manga_translator.pipeline_params as pp


def test_model_dir_override_when_given(monkeypatch):
    monkeypatch.setattr(pp.ModelWrapper, '_MODEL_DIR', 'ORIGINAL', raising=False)
    pp.apply_global_settings({'model_dir': '/custom/models'})
    assert pp.ModelWrapper._MODEL_DIR == '/custom/models'


def test_model_dir_unchanged_when_absent_or_empty(monkeypatch):
    monkeypatch.setattr(pp.ModelWrapper, '_MODEL_DIR', 'ORIGINAL', raising=False)
    pp.apply_global_settings({})  # no key -> no override
    assert pp.ModelWrapper._MODEL_DIR == 'ORIGINAL'
    pp.apply_global_settings({'model_dir': ''})  # falsy -> no override (verbatim guard)
    assert pp.ModelWrapper._MODEL_DIR == 'ORIGINAL'


def test_sets_tf32_backend_flags(monkeypatch):
    monkeypatch.setattr(pp.torch.backends.cuda.matmul, 'allow_tf32', False, raising=False)
    monkeypatch.setattr(pp.torch.backends.cudnn, 'allow_tf32', False, raising=False)
    pp.apply_global_settings({})
    assert pp.torch.backends.cuda.matmul.allow_tf32 is True
    assert pp.torch.backends.cudnn.allow_tf32 is True


# ── PipelineParams value-object (#187 S12, value-object half) ─────────────────
# Pins the device / using_gpu / gpu-limited / raise logic + field parsing + the
# batch_concurrent auto-disable that MangaTranslator.parse_init_params did inline,
# so the extraction is byte-identical. torch GPU availability is monkeypatched so
# the device branches are deterministic.

def _gpu(monkeypatch, cuda: bool, mps: bool):
    monkeypatch.setattr('torch.cuda.is_available', lambda: cuda)
    monkeypatch.setattr('torch.backends.mps.is_available', lambda: mps)


def test_device_cpu_when_use_gpu_false(monkeypatch):
    _gpu(monkeypatch, cuda=True, mps=False)            # gpu available but not requested
    params = pp.PipelineParams.from_params({'kernel_size': 3}, batch_concurrent=False)
    assert params.device == 'cpu'
    assert params.using_gpu is False


def test_device_cuda_when_use_gpu_true(monkeypatch):
    _gpu(monkeypatch, cuda=True, mps=False)
    params = pp.PipelineParams.from_params({'use_gpu': True, 'kernel_size': 3}, batch_concurrent=False)
    assert params.device == 'cuda'
    assert params.using_gpu is True


def test_device_mps_when_only_mps(monkeypatch):
    _gpu(monkeypatch, cuda=False, mps=True)
    params = pp.PipelineParams.from_params({'use_gpu': True, 'kernel_size': 3}, batch_concurrent=False)
    assert params.device == 'mps'
    assert params.using_gpu is True


def test_gpu_limited_forces_device_even_without_use_gpu(monkeypatch):
    _gpu(monkeypatch, cuda=True, mps=False)
    params = pp.PipelineParams.from_params(
        {'use_gpu': False, 'use_gpu_limited': True, 'kernel_size': 3}, batch_concurrent=False)
    assert params.device == 'cuda'                     # gpu-limited branch promotes cpu->available
    assert params.gpu_limited_memory is True


def test_raises_when_use_gpu_but_no_device(monkeypatch):
    _gpu(monkeypatch, cuda=False, mps=False)
    import pytest
    with pytest.raises(Exception) as e:
        pp.PipelineParams.from_params({'use_gpu': True, 'kernel_size': 3}, batch_concurrent=False)
    assert 'CUDA or Metal' in str(e.value)


def test_batch_concurrent_auto_disabled_below_batch_size_2(monkeypatch):
    _gpu(monkeypatch, cuda=True, mps=False)
    params = pp.PipelineParams.from_params({'kernel_size': 3, 'batch_size': 1}, batch_concurrent=True)
    assert params.batch_concurrent is False
    assert params.batch_size == 1


def test_batch_concurrent_kept_at_batch_size_2plus(monkeypatch):
    _gpu(monkeypatch, cuda=True, mps=False)
    params = pp.PipelineParams.from_params({'kernel_size': 3, 'batch_size': 2}, batch_concurrent=True)
    assert params.batch_concurrent is True


def test_all_fields_passthrough(monkeypatch):
    _gpu(monkeypatch, cuda=True, mps=False)
    params = pp.PipelineParams.from_params({
        'kernel_size': 5, 'verbose': True, 'use_mtpe': True, 'font_path': '/f.ttf',
        'models_ttl': 30, 'ignore_errors': True, 'input': ['a.png'],
        'save_text': True, 'load_text': True,
    }, batch_concurrent=False)
    assert params.kernel_size == 5
    assert params.verbose is True and params.use_mtpe is True and params.font_path == '/f.ttf'
    assert params.models_ttl == 30 and params.ignore_errors is True
    assert params.input_files == ['a.png'] and params.save_text is True and params.load_text is True


def test_parse_init_params_delegation_assigns_fields(monkeypatch):
    """End-to-end delegation: MangaTranslator.parse_init_params reads
    self.batch_concurrent, calls PipelineParams.from_params, and assigns every
    field back to self. Exercised WITHOUT constructing the god object — a
    SimpleNamespace stands in for self (the method touches only
    self.batch_concurrent + the 13 written fields), so the __init__ side effects
    (the builtins.print redirect) never run. Closes the seam between the value
    object and the constructor."""
    from types import SimpleNamespace
    from manga_translator.manga_translator import MangaTranslator
    _gpu(monkeypatch, cuda=True, mps=False)
    obj = SimpleNamespace(batch_concurrent=True)
    MangaTranslator.parse_init_params(
        obj, {'kernel_size': 7, 'use_gpu': True, 'verbose': True, 'batch_size': 1})
    assert obj.device == 'cuda'            # use_gpu -> device assigned from value object
    assert obj.kernel_size == 7
    assert obj.verbose is True
    assert obj.batch_size == 1
    assert obj.batch_concurrent is False   # auto-disabled (batch_size 1) flows through delegation
