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
