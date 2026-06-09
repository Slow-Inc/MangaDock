"""Per-image debug-folder context (#187 seam S11).

`ImageDebugContext` consolidates the scattered `_current_image_context` /
`_saved_image_contexts` instance state and the verbose/web `result_path` computation
that lived on the god object, plus a `with_context` manager replacing the manual
save/restore swap closures. Behaviour is preserved verbatim, including the
non-verbose web-mode default subfolder and the `makedirs(dirname)` side effect.
"""
import os

import manga_translator.image_debug_context as idc


def test_subfolder_empty_when_no_current():
    assert idc.ImageDebugContext().subfolder == ''


def test_subfolder_returns_current_subfolder():
    c = idc.ImageDebugContext()
    c.current = {'subfolder': 'SF', 'file_md5': 'm', 'config': None}
    assert c.subfolder == 'SF'


def test_save_and_restore_round_trip():
    c = idc.ImageDebugContext()
    c.current = {'subfolder': 'A', 'file_md5': 'md5a', 'config': None}
    c.save('md5a')
    c.current = {'subfolder': 'B', 'file_md5': 'md5b', 'config': None}
    assert c.restore('md5a') is True
    assert c.current['subfolder'] == 'A'
    assert c.restore('missing') is False  # unknown md5 -> False, current unchanged
    assert c.current['subfolder'] == 'A'


def test_save_is_a_noop_when_no_current():
    c = idc.ImageDebugContext()
    c.save('x')  # current is None -> nothing saved
    assert c.restore('x') is False


def test_with_context_swaps_then_restores():
    c = idc.ImageDebugContext()
    original = {'subfolder': 'orig', 'file_md5': 'o', 'config': None}
    c.current = original
    swapped = {'subfolder': 'swap', 'file_md5': 's', 'config': None}
    with c.with_context(swapped):
        assert c.current is swapped
    assert c.current is original  # restored even normally


def test_with_context_restores_on_exception():
    c = idc.ImageDebugContext()
    original = {'subfolder': 'orig'}
    c.current = original
    try:
        with c.with_context({'subfolder': 'swap'}):
            raise ValueError("boom")
    except ValueError:
        pass
    assert c.current is original


def _no_makedirs(monkeypatch):
    monkeypatch.setattr(idc.os, 'makedirs', lambda *a, **k: None)


def test_result_path_verbose_with_subfolder_no_result_sub(monkeypatch):
    _no_makedirs(monkeypatch)
    c = idc.ImageDebugContext()
    c.current = {'subfolder': 'SF'}
    out = c.result_path('mask.png', verbose=True, result_sub_folder='')
    assert out == os.path.join(idc.BASE_PATH, 'result', 'SF', 'mask.png')


def test_result_path_verbose_with_subfolder_and_result_sub(monkeypatch):
    _no_makedirs(monkeypatch)
    c = idc.ImageDebugContext()
    c.current = {'subfolder': 'SF'}
    out = c.result_path('mask.png', verbose=True, result_sub_folder='job1')
    assert out == os.path.join(idc.BASE_PATH, 'result', 'job1', 'SF', 'mask.png')


def test_result_path_web_mode_uses_current_subfolder(monkeypatch):
    _no_makedirs(monkeypatch)
    c = idc.ImageDebugContext()
    c.current = {'subfolder': 'SF'}
    # verbose False, no result_sub_folder -> web mode, uses current subfolder
    out = c.result_path('final.png', verbose=False, result_sub_folder='')
    assert out == os.path.join(idc.BASE_PATH, 'result', 'SF', 'final.png')


def test_result_path_web_mode_no_current_uses_default_unknown(monkeypatch):
    _no_makedirs(monkeypatch)
    c = idc.ImageDebugContext()  # current None
    out = c.result_path('final.png', verbose=False, result_sub_folder='')
    # default subfolder is "{timestamp}-unknown-1024-unknown-unknown"
    parts = out.split(os.sep)
    assert parts[-1] == 'final.png'
    assert parts[-2].endswith('-unknown-1024-unknown-unknown')


def test_result_path_with_result_sub_folder_set(monkeypatch):
    _no_makedirs(monkeypatch)
    c = idc.ImageDebugContext()
    out = c.result_path('final.png', verbose=False, result_sub_folder='job1')
    assert out == os.path.join(idc.BASE_PATH, 'result', 'job1', 'final.png')


def test_set_builds_subfolder_from_config_and_md5(monkeypatch):
    monkeypatch.setattr(idc, 'get_image_md5', lambda img: 'MD5X')
    c = idc.ImageDebugContext()
    config = type('C', (), {})()
    config.detector = type('D', (), {'detection_size': 1536})()
    config.translator = type('T', (), {'target_lang': 'ENG', 'translator': 'gpt'})()
    c.set(config, image=object())
    assert c.current['file_md5'] == 'MD5X'
    # subfolder = {timestamp}-{md5}-{detection_size}-{target}-{translator}
    assert c.current['subfolder'].endswith('-MD5X-1536-ENG-gpt')
    assert c.current['config'] is config


def test_set_without_image_uses_unknown_md5(monkeypatch):
    c = idc.ImageDebugContext()
    config = type('C', (), {})()
    config.detector = type('D', (), {})()  # no detection_size -> default 1024
    config.translator = type('T', (), {})()  # no target/translator -> 'unknown'
    c.set(config, image=None)
    assert c.current['file_md5'] == 'unknown'
    assert c.current['subfolder'].endswith('-unknown-1024-unknown-unknown')
