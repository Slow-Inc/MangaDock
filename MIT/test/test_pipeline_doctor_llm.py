"""The Doctor's LLM/gateway contract probes (#688, part of #685).

These four contracts cover the layer nothing in the repo looks at today, and the bar they are
written to is not "the probes exist" — it is that the **three defects found on 2026-07-28**
(`docs/reports/benchmarks/2026-07-28-679-sfx-gate.md`) each surface as their own line with their
own evidence. Every threshold below is a measurement from that report, cited where it is used.

The contracts inspect what *we* build and what *we* parse, never what the gateway answers, which
is what makes them torch-free and runnable in the `mit_logic` gate: `capture_sfx_call` runs the
real `vlm_localize_sfx` with the HTTP call injected, so a probe reports on production code rather
than on a copy of it that can drift.
"""
import pathlib

import numpy as np

from tools.pipeline_doctor import FAIL, OK, WARN, doctor
from manga_translator.ocr_vlm import SFX_MAX_TOKENS
from tools.pipeline_doctor.llm_contracts import (
    BUDGET_MEASURED_COMPLETING,
    BUDGET_MEASURED_TRUNCATING,
    VISION_TOKENS_MEASURED_ANSWERING,
    DoctorPage,
    SfxCall,
    capture_sfx_call,
)

#: `MIT/` — where `pythonpath = .` puts the `tools` and `manga_translator` packages.
MIT_ROOT = pathlib.Path(__file__).resolve().parent.parent

# The `ぬ` display-SFX crop of the 2026-07-28 investigation, at the size the pipeline sends it.
CROP_W, CROP_H = 220, 130

# B1/B2: HTTP 200, reasoning burned the whole budget, so the reply carries no content.
TRUNCATED_RESPONSE = {
    'choices': [{'finish_reason': 'length', 'message': {'content': None}}],
}
HEALTHY_RESPONSE = {
    'choices': [{'finish_reason': 'stop', 'message': {'content': 'SQUELCH'}}],
}


def _crop(w=CROP_W, h=CROP_H, fill=None):
    """A crop with the ink profile of lettering, so the #887 crop guard does not refuse it."""
    if fill is not None:
        return np.full((h, w, 3), fill, dtype=np.uint8)
    crop = np.full((h, w, 3), 250, dtype=np.uint8)
    crop[h // 4:3 * h // 4, w // 8:3 * w // 8] = 28      # two separate thick strokes
    crop[h // 4:3 * h // 4, 5 * w // 8:7 * w // 8] = 28
    return crop


def _page(response=TRUNCATED_RESPONSE, crop=None, target_lang='ENG'):
    return DoctorPage(sfx_call=capture_sfx_call(
        _crop() if crop is None else crop, response=response, target_lang=target_lang))


def _stage(run, stage):
    found = [r for r in run.reports if r.stage == stage]
    assert found, f'no {stage} row in {[r.stage for r in run.reports]}'
    return found[0]


# --------------------------------------------------------------------------- capture

def test_capture_runs_the_real_call_and_records_what_it_built():
    """The captured request must come from `vlm_localize_sfx` itself. A probe reading a
    hand-written copy of the payload would stay green through the very edit it exists to catch."""
    call = capture_sfx_call(_crop(), response=HEALTHY_RESPONSE, model='qwen3.6-35b-a3b')
    assert call.request['model'] == 'qwen3.6-35b-a3b'
    assert call.request['max_tokens'] == SFX_MAX_TOKENS   # what the shipped code sends (#881)
    assert call.result == 'SQUELCH'                # the real sanitise ran on the real reply


def test_capture_surfaces_the_image_the_call_actually_sent():
    call = capture_sfx_call(_crop(), response=HEALTHY_RESPONSE)
    assert call.image_size == (CROP_W, CROP_H)     # native size, no upscale — defect 2
    assert call.image_mode == 'RGB'


def test_capture_never_records_the_api_key():
    """The report is committed to benchmarks and pasted into issues; a captured Authorization
    header would leak a live gateway key into git."""
    call = capture_sfx_call(_crop(), response=HEALTHY_RESPONSE, api_key='sk-secret-value')
    assert 'sk-secret-value' not in repr(call.request)
    assert 'sk-secret-value' not in str(call.to_metrics())


# --------------------------------------------------------------------------- 1. request

def test_request_fails_on_a_budget_measured_to_truncate():
    """Defect 1. On the configured model 24 and 128 both returned `length` with `content: ''`
    (re-measured 2026-10-22, #881); 192 completed. The shipped budget clears the floor, so the
    contract is pinned at the measured truncating point."""
    call = capture_sfx_call(_crop(), response=HEALTHY_RESPONSE)
    call.request['max_tokens'] = BUDGET_MEASURED_TRUNCATING
    row = _stage(doctor.run(DoctorPage(sfx_call=call)), 'vlm-send')
    assert row.status == FAIL
    assert row.metrics['max_tokens'] == BUDGET_MEASURED_TRUNCATING
    assert str(BUDGET_MEASURED_COMPLETING) in row.evidence
    assert 'thinking' in row.evidence          # the mechanism, not just the number


def test_request_passes_at_the_budget_the_code_ships():
    """#881: `SFX_MAX_TOKENS` is above the measured floor, so the probe no longer blocks the
    budget the rescue actually sends."""
    row = _stage(doctor.run(_page()), 'vlm-send')
    assert row.status == OK
    assert row.metrics['max_tokens'] == SFX_MAX_TOKENS


def test_request_reports_the_thinking_control_as_unset():
    """B2: the same prompt answers in 3 tokens with `enable_thinking=false`. `ocr_vlm` never
    calls the helpers the translator path uses, so the payload carries no thinking control."""
    row = _stage(doctor.run(_page()), 'vlm-send')
    assert row.metrics['thinking'] == 'unset'


def test_request_passes_once_the_budget_clears_the_measured_floor():
    call = capture_sfx_call(_crop(), response=HEALTHY_RESPONSE)
    call.request['max_tokens'] = BUDGET_MEASURED_COMPLETING
    call.request['chat_template_kwargs'] = {'enable_thinking': False}
    row = _stage(doctor.run(DoctorPage(sfx_call=call)), 'vlm-send')
    assert row.status == OK


def test_request_fails_when_no_model_is_configured():
    call = capture_sfx_call(_crop(), response=HEALTHY_RESPONSE)
    call.request['model'] = ''
    row = _stage(doctor.run(DoctorPage(sfx_call=call)), 'vlm-send')
    assert row.status == FAIL


def test_a_budget_between_the_two_measurements_only_warns():
    """(2048, 4096) is unmeasured. Reporting it as FAIL would state a boundary nobody located."""
    call = capture_sfx_call(_crop(), response=HEALTHY_RESPONSE)
    call.request['max_tokens'] = (BUDGET_MEASURED_TRUNCATING + BUDGET_MEASURED_COMPLETING) // 2
    call.request['chat_template_kwargs'] = {'enable_thinking': False}
    row = _stage(doctor.run(DoctorPage(sfx_call=call)), 'vlm-send')
    assert row.status == WARN


# --------------------------------------------------------------------------- 2. image

def test_image_warns_below_the_provisional_vision_floor():
    """Defect 2, and U1: this threshold rests on one measurement, so it may never be a FAIL."""
    row = _stage(doctor.run(_page()), 'vlm-image')
    assert row.status == WARN
    assert row.metrics['size'] == f'{CROP_W}x{CROP_H}'
    assert 'provisional' in row.evidence.lower()
    assert str(VISION_TOKENS_MEASURED_ANSWERING) in row.evidence


def test_image_passes_at_the_size_measured_to_be_answered():
    row = _stage(doctor.run(_page(crop=_crop(CROP_W * 3, CROP_H * 3))), 'vlm-image')
    assert row.status == OK


def test_a_blank_canvas_is_never_sent_887():
    """B3: the model answers confidently over a uniform crop, so a blank canvas cannot be caught
    downstream. Since #887 the crop guard refuses it before any request is built — the contract is
    now met upstream, and the probe reports that instead of pretending an empty request is a bug."""
    row = _stage(doctor.run(_page(crop=_crop(fill=255))), 'vlm-image')
    assert row.status == OK
    assert 'lettering' in row.evidence.lower()


def test_image_fails_when_the_sent_image_is_not_rgb():
    """`_to_data_url` always converts the crop to RGB before encoding, so a non-RGB image can
    never reach the probe through `capture_sfx_call` — the mode check is only reachable by
    building the call directly."""
    call = SfxCall(request={}, response=HEALTHY_RESPONSE, result='SQUELCH',
                   image_size=(CROP_W * 3, CROP_H * 3), image_mode='L')
    row = _stage(doctor.run(DoctorPage(sfx_call=call)), 'vlm-image')
    assert row.status == FAIL
    assert row.metrics['mode'] == 'L'


# --------------------------------------------------------------------------- 3. response

def test_response_fails_loudly_on_the_truncation_that_was_silent():
    """Defect 1's visible half. `''` is today indistinguishable from 'no SFX here' — the whole
    reason 2026-07-11 concluded 'text MoE' and moved on."""
    row = _stage(doctor.run(_page()), 'vlm-recv')
    assert row.status == FAIL
    assert row.metrics['finish_reason'] == 'length'
    assert row.metrics['content'] == 'None'
    assert str(SFX_MAX_TOKENS) in row.evidence   # names the budget that truncated it


def test_response_passes_on_a_completed_reply():
    row = _stage(doctor.run(_page(response=HEALTHY_RESPONSE)), 'vlm-recv')
    assert row.status == OK


def test_response_fails_on_a_malformed_payload_rather_than_crashing_the_walk():
    row = _stage(doctor.run(_page(response={})), 'vlm-recv')
    assert row.status == FAIL


def test_response_fails_on_a_truncated_reply_that_still_carries_content():
    """`finish_reason='length'` with content present is still a truncation — the reply was cut
    off mid-answer. Deleting `or finish != 'stop'` would let this through as OK."""
    row = _stage(doctor.run(_page(response={'choices': [{'finish_reason': 'length',
                                                        'message': {'content': 'BAM'}}]})),
                 'vlm-recv')
    assert row.status == FAIL
    assert row.metrics['finish_reason'] == 'length'
    assert row.metrics['content'] == 'BAM'


# --------------------------------------------------------------------------- 4. sanitise

def test_sanitise_passes_now_that_refusals_are_rejected():
    """Defect 3 fixed by #697: every refusal in the corpus now sanitises to ''."""
    row = _stage(doctor.run(_page()), 'sanitize')
    assert row.status == OK
    assert row.metrics['leaked'] == 0


def test_sanitise_still_names_every_refusal_a_leaky_sanitiser_lets_through(monkeypatch):
    """The detector must still find a leak: swap in the pre-#697 behaviour (echo the reply)."""
    import tools.pipeline_doctor.llm_contracts as lc
    monkeypatch.setattr(lc, 'sanitize_sfx', lambda raw, lang='ENG': raw.upper())
    row = _stage(doctor.run(_page()), 'sanitize')
    assert row.status == FAIL
    assert 'EMPTY LINE' in row.evidence
    assert row.metrics['leaked'] >= 2


def test_sanitise_checks_localized_refusals_for_a_non_latin_target():
    """B3 recorded these from the live model; the non-Latin branch guards only Latin forms."""
    row = _stage(doctor.run(_page(target_lang='THA')), 'sanitize')
    assert row.status == OK   # #697 rejects parenthesised and ไม่-negation replies


# --------------------------------------------------------------------------- coexistence

def test_the_probes_stand_down_for_a_page_that_carries_no_llm_call():
    """#687's probes walk the same registry over a committed dump. A page without an SFX call
    must produce no LLM rows at all, rather than four rows of vacuous OKs."""
    run = doctor.run(DoctorPage())
    assert [r for r in run.reports if r.stage in
            ('vlm-send', 'vlm-image', 'vlm-recv', 'sanitize')] == []


# --------------------------------------------------------------------------- acceptance

def test_one_run_surfaces_all_three_defects_of_2026_07_28():
    """#685's falsifiable bar. Three defects, three distinct lines, each naming its own
    evidence — asserted on the rendered table, because the table is what a developer reads.
    Defect 1 is pinned with a budget at the measured truncating point: #881 fixed the shipped
    budget, so the default call no longer truncates."""
    page = _page()
    page.sfx_call.request['max_tokens'] = BUDGET_MEASURED_TRUNCATING
    run = doctor.run(page)
    table = run.to_table()

    assert run.ok is False
    assert 'vlm-send' in run.failures      # truncating budget, thinking unset
    assert 'vlm-recv' in run.failures      # finish_reason=length, content=None
    assert 'sanitize' not in run.failures  # fixed by #697; row still rendered below
    assert 'vlm-image' in run.warnings     # undersized crop, provisional threshold

    for stage in ('vlm-send', 'vlm-image', 'vlm-recv', 'sanitize'):
        line = next(line for line in table.splitlines() if line.startswith(stage))
        assert line.strip() != stage, f'{stage} row carries no evidence'


def test_the_json_view_carries_the_same_verdicts_for_an_agent():
    payload = doctor.run(_page()).to_json()
    stages = {s['stage']: s for s in payload['stages']}
    assert payload['exit_code'] == 1
    assert stages['vlm-recv']['status'] == FAIL
    assert stages['vlm-image']['status'] == WARN


def test_the_contracts_import_without_torch():
    """They belong to the `mit_logic` gate, which installs no ML stack at all.

    Checked in a subprocess on purpose. Asserting `'torch' not in sys.modules` inline passes in
    CI (where torch is not installed) and fails locally the moment any earlier test module has
    already imported the pipeline — it would measure the suite's import order, not this module's
    import graph, and would be green in exactly the environment that cannot detect a regression.
    """
    import subprocess
    import sys

    probe = ('import sys; import tools.pipeline_doctor.llm_contracts; '
             "sys.exit(1 if 'torch' in sys.modules else 0)")
    assert subprocess.run([sys.executable, '-c', probe], cwd=MIT_ROOT).returncode == 0
