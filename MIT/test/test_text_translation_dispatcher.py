"""Unified text-translation dispatch (#187 seam S17).

`build_chatgpt_translator` + `dispatch_translate` collapse the chatgpt-translator handling
that was duplicated in `_dispatch_with_context` (single) and `_batch_translate_texts`
(batch). Construction is split out so each caller preserves its own ordering relative to
the context log (the ctor can warn about the glossary). Per-mode divergence — the
chatgpt_2stage `result_path_callback` (single = bound `_result_path`, batch = image-context
swap closure) and the batch_contexts wiring (`on_2stage_batch_setup`) — is parameterised.
The async path is driven via `asyncio.run`.
"""
import asyncio
import sys
import types
from types import SimpleNamespace

from manga_translator.config import Translator
from manga_translator.text_translation_dispatcher import (
    build_chatgpt_translator,
    dispatch_translate,
)


class _FakeTranslator:
    def __init__(self, name):
        self.name = name
        self.rec = []

    def parse_args(self, tcfg):
        self.rec.append(('parse_args', tcfg))

    def set_prev_context(self, pc):
        self.rec.append(('set_prev_context', pc))

    async def _translate(self, *args):
        self.rec.append(('_translate', args))
        return [f'{self.name}:{t}' for t in args[2]]


def _config(kind):
    return SimpleNamespace(translator=SimpleNamespace(
        translator=kind, target_lang='TH', translator_gen='GEN'))


def _ctx():
    return SimpleNamespace(from_lang='JA')


# ---- build_chatgpt_translator (lazy import switch) ----

def test_build_chatgpt_returns_openai_translator(monkeypatch):
    made = {}
    mod = types.ModuleType('manga_translator.translators.chatgpt')
    mod.OpenAITranslator = lambda: made.setdefault('o', object())
    monkeypatch.setitem(sys.modules, 'manga_translator.translators.chatgpt', mod)
    t = build_chatgpt_translator(Translator.chatgpt)
    assert t is made['o']


def test_build_chatgpt_returns_2stage_translator(monkeypatch):
    made = {}
    mod = types.ModuleType('manga_translator.translators.chatgpt_2stage')
    mod.ChatGPT2StageTranslator = lambda: made.setdefault('t', object())
    monkeypatch.setitem(sys.modules, 'manga_translator.translators.chatgpt_2stage', mod)
    t = build_chatgpt_translator(Translator.chatgpt_2stage)
    assert t is made['t']


# ---- dispatch_translate (parse/set/log/translate) ----

def test_chatgpt_parses_sets_context_translates_without_ctx():
    tr = _FakeTranslator('openai')
    cfg, ctx = _config(Translator.chatgpt), _ctx()
    out = asyncio.run(dispatch_translate(
        tr, ['a', 'b'], cfg, ctx, prev_ctx='PREV', pages_used=0, skipped=0,
        result_path_callback='RPC', on_2stage_batch_setup=None))
    assert out == ['openai:a', 'openai:b']
    assert ('parse_args', cfg.translator) in tr.rec
    assert ('set_prev_context', 'PREV') in tr.rec
    assert ('_translate', ('JA', 'TH', ['a', 'b'])) in tr.rec  # NO ctx (3 args)
    assert not hasattr(ctx, 'result_path_callback')  # only chatgpt_2stage sets it


def test_chatgpt2stage_sets_callback_runs_batch_setup_translates_with_ctx():
    tr = _FakeTranslator('2stage')
    cfg, ctx = _config(Translator.chatgpt_2stage), _ctx()
    setup_calls = []
    out = asyncio.run(dispatch_translate(
        tr, ['x'], cfg, ctx, prev_ctx='PREV', pages_used=0, skipped=0,
        result_path_callback='RPC',
        on_2stage_batch_setup=lambda c: setup_calls.append(c)))
    assert out == ['2stage:x']
    assert ctx.result_path_callback == 'RPC'
    assert setup_calls == [ctx]
    assert ('_translate', ('JA', 'TH', ['x'], ctx)) in tr.rec  # WITH ctx (4 args)


def test_chatgpt_does_not_run_batch_setup():
    tr = _FakeTranslator('openai')
    cfg, ctx = _config(Translator.chatgpt), _ctx()
    setup_calls = []
    asyncio.run(dispatch_translate(
        tr, ['x'], cfg, ctx, prev_ctx='P', pages_used=0, skipped=0,
        result_path_callback='RPC',
        on_2stage_batch_setup=lambda c: setup_calls.append(c)))
    assert setup_calls == []  # batch-setup is chatgpt_2stage-only


def test_carrying_and_skipped_logs(caplog):
    import logging
    tr = _FakeTranslator('openai')
    cfg, ctx = _config(Translator.chatgpt), _ctx()
    with caplog.at_level(logging.INFO, logger='manga_translator'):
        asyncio.run(dispatch_translate(
            tr, ['a'], cfg, ctx, prev_ctx='<|1|>x<|2|>y', pages_used=3, skipped=1,
            result_path_callback='RPC', on_2stage_batch_setup=None))
    msgs = [r.message for r in caplog.records]
    assert "Carrying 3 pages of context, 2 sentences as translation reference" in msgs
    assert "Skipped 1 pages with no sentences" in msgs
