"""The Doctor's report model and runner (#686, part of #685).

Every probe in the epic reports through this one model, and both renderings — the terminal
table and the agent-facing JSON — are views over it. The rules that matter are about which
verdicts stop a run: a `FAIL` is a broken contract and must be actionable by an agent branching
on the exit code, while a `WARN` covers thresholds that are still provisional (the vision-
resolution floor rests on a single measurement) and must not block anyone's work.

Torch-free by construction: the core orchestrates probes and never imports the pipeline.
"""
from tools.pipeline_doctor import FAIL, OK, WARN, DoctorRun, StageReport


def test_a_run_of_healthy_stages_succeeds():
    run = DoctorRun([
        StageReport('detect', 'OK', metrics={'regions': 12}),
        StageReport('ocr', 'OK', metrics={'read': 12, 'empty': 0}),
    ])
    assert run.ok is True
    assert run.exit_code == 0


def test_a_warn_does_not_stop_the_run():
    """Thresholds are provisional — the vision-resolution floor rests on one measurement —
    so a `WARN` must be visible without blocking anyone's work."""
    run = DoctorRun([
        StageReport('vlm-send', WARN, metrics={'prompt_tokens': 112},
                    evidence='crop 220x130 is below the provisional vision floor'),
    ])
    assert run.ok is True
    assert run.exit_code == 0
    assert run.warnings == ['vlm-send']


def test_a_fail_stops_the_run_and_names_the_stage():
    run = DoctorRun([
        StageReport('vlm-send', WARN, metrics={'prompt_tokens': 112}),
        StageReport('vlm-recv', FAIL, evidence='finish_reason=length, content=None'),
        StageReport('render', OK),
    ])
    assert run.ok is False
    assert run.exit_code == 1
    assert run.failures == ['vlm-recv']


def test_json_gives_an_agent_something_to_branch_on():
    """An agent must not have to parse prose. Keys are a contract: renaming one silently
    breaks every caller, so they are asserted here rather than left to the renderer."""
    run = DoctorRun([
        StageReport('vlm-recv', FAIL, metrics={'finish_reason': 'length'},
                    evidence='content=None at max_tokens=24'),
        StageReport('render', OK, metrics={'placed': 8}),
    ])
    doc = run.to_json()

    assert doc['ok'] is False
    assert doc['exit_code'] == 1
    assert doc['failures'] == ['vlm-recv']
    assert doc['warnings'] == []
    assert [s['stage'] for s in doc['stages']] == ['vlm-recv', 'render'], 'stage order must survive'
    first = doc['stages'][0]
    assert first == {
        'stage': 'vlm-recv',
        'status': 'FAIL',
        'metrics': {'finish_reason': 'length'},
        'evidence': 'content=None at max_tokens=24',
    }


def test_the_table_shows_the_verdict_and_the_evidence_behind_it():
    """A status with no evidence is what made today's failures take ten probes to explain,
    so the row carries the reason next to the verdict rather than only in a log somewhere."""
    run = DoctorRun([
        StageReport('detect', OK, metrics={'regions': 12, 'det_sfx': 3}),
        StageReport('vlm-recv', FAIL, metrics={'finish_reason': 'length'},
                    evidence='truncated at max_tokens=24'),
    ])
    lines = run.to_table().splitlines()

    assert len(lines) == 2, 'one row per stage, no header noise'
    assert lines[0].startswith('detect'), 'stage order preserved'
    assert 'OK' in lines[0] and 'regions=12' in lines[0] and 'det_sfx=3' in lines[0]
    assert 'FAIL' in lines[1] and 'truncated at max_tokens=24' in lines[1]
    # columns line up, so a human can scan the status column
    assert lines[0].index('OK') == lines[1].index('FAIL')


def test_json_round_trips_through_the_json_module():
    """`to_json` must return something `json.dumps` accepts — an agent reads it over a pipe."""
    import json
    run = DoctorRun([StageReport('detect', OK, metrics={'regions': 12})])
    assert json.loads(json.dumps(run.to_json()))['stages'][0]['metrics']['regions'] == 12
