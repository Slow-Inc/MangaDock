"""The Doctor's report model and runner (#686, part of #685).

Every probe in the epic reports through this one model, and both renderings — the terminal
table and the agent-facing JSON — are views over it. The rules that matter are about which
verdicts stop a run: a `FAIL` is a broken contract and must be actionable by an agent branching
on the exit code, while a `WARN` covers thresholds that are still provisional (the vision-
resolution floor rests on a single measurement) and must not block anyone's work.

Torch-free by construction: the core orchestrates probes and never imports the pipeline.
"""
from tools.pipeline_doctor import FAIL, OK, WARN, DoctorRun, ProbeRegistry, StageReport


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


# --- the runner: probes register themselves, the core only orchestrates ----------------


def test_probes_register_themselves_and_the_runner_walks_them_in_pipeline_order():
    """The core must not know the pipeline — that is what keeps it torch-free. Probes attach
    themselves to a registry and the runner replays them in registration order, which *is*
    pipeline order; sorting them would put `render` before `vlm-send`."""
    doctor = ProbeRegistry()

    @doctor.probe('detect')
    def _detect(page):
        return StageReport('detect', OK, metrics={'regions': page['regions']})

    @doctor.probe('vlm-send')
    def _send(page):
        return StageReport('vlm-send', OK, metrics={'prompt_tokens': 287})

    @doctor.probe('render')
    def _render(page):
        return StageReport('render', OK, metrics={'placed': page['regions']})

    run = doctor.run({'regions': 12})

    assert [r.stage for r in run.reports] == ['detect', 'vlm-send', 'render']
    assert run.reports[0].metrics == {'regions': 12}, 'the probe is handed the page'
    assert run.ok is True and run.exit_code == 0


def test_a_probe_that_does_not_apply_contributes_no_row():
    """Not every stage runs on every page — an SFX probe on a page with no SFX has nothing to
    report, and an empty row would read as a verdict it never made."""
    doctor = ProbeRegistry()

    @doctor.probe('detect')
    def _detect(page):
        return StageReport('detect', OK)

    @doctor.probe('sfx-gate')
    def _sfx(page):
        return None

    assert [r.stage for r in doctor.run({}).reports] == ['detect']


def test_a_crashing_probe_becomes_a_fail_row_and_the_later_stages_still_run():
    """A diagnostic that dies on the first broken stage reports nothing about the remaining
    ones — least useful exactly when it is most needed. The crash is a verdict, not an abort,
    and the exception travels as the evidence for it."""
    doctor = ProbeRegistry()

    @doctor.probe('detect')
    def _detect(page):
        return StageReport('detect', OK)

    @doctor.probe('ocr')
    def _ocr(page):
        raise KeyError('prob')

    @doctor.probe('render')
    def _render(page):
        return StageReport('render', OK, metrics={'placed': 8})

    run = doctor.run({})

    assert [r.stage for r in run.reports] == ['detect', 'ocr', 'render'], 'the run continued'
    crashed = run.reports[1]
    assert crashed.status == FAIL
    assert 'KeyError' in crashed.evidence and 'prob' in crashed.evidence
    assert run.failures == ['ocr']
    assert run.exit_code == 1


def test_a_fake_probe_set_produces_both_renderings_from_one_run():
    """#686's acceptance shape, end to end: one run over registered probes, two views of the
    same data, carrying the same verdicts — a human and an agent must never read different
    ones. The two stages are defects 1 and 2 from 2026-07-28."""
    doctor = ProbeRegistry()

    @doctor.probe('vlm-send')
    def _send(page):
        return StageReport('vlm-send', WARN, metrics={'prompt_tokens': 112},
                           evidence='below the provisional vision floor (>=250)')

    @doctor.probe('vlm-recv')
    def _recv(page):
        return StageReport('vlm-recv', FAIL, metrics={'finish_reason': 'length'},
                           evidence='content=None, truncated at max_tokens=24')

    run = doctor.run({})
    doc, lines = run.to_json(), run.to_table().splitlines()

    assert doc['warnings'] == ['vlm-send'] and doc['failures'] == ['vlm-recv']
    assert doc['exit_code'] == 1
    assert [s['status'] for s in doc['stages']] == ['WARN', 'FAIL']

    assert len(lines) == 2, 'one row per stage'
    assert 'WARN' in lines[0] and 'prompt_tokens=112' in lines[0]
    assert 'FAIL' in lines[1] and 'truncated at max_tokens=24' in lines[1]


def test_the_package_ships_a_default_registry_for_probes_to_attach_to():
    """The later deliverables (#685's deterministic probes and LLM contract checks) attach by
    importing the package, so the shared registry is part of *this* deliverable's contract."""
    from tools.pipeline_doctor import doctor

    assert isinstance(doctor, ProbeRegistry)


# --- the table renders probe-supplied text, which is not the probe author's to trust ---------


def test_the_table_keeps_one_row_per_stage_when_the_evidence_spans_lines():
    """`to_table` promises one row per stage and an aligned status column. A probe reporting
    what a model actually emitted can hand it a newline, and a row that wraps destroys both."""
    run = DoctorRun([
        StageReport('detect', OK),
        StageReport('vlm-recv', FAIL, evidence='refused:\nEMPTY LINE'),
    ])
    lines = run.to_table().splitlines()

    assert len(lines) == 2, 'one row per stage, whatever the probe put in the evidence'
    assert 'EMPTY LINE' in lines[1], 'the evidence is still legible, not dropped'
    assert lines[0].index('OK') == lines[1].index('FAIL'), 'the status column still lines up'


def test_the_table_neutralises_control_characters_from_model_output():
    r"""The sanitize probe's evidence is a string the *model* produced. Rendered raw into a
    terminal, an escape sequence executes — `\x1b[2J` clears the developer's screen and the
    next code recolours what follows, so a FAIL can be made to look like anything.

    They are escaped rather than stripped: which bytes came back is the diagnosis.
    """
    run = DoctorRun([
        StageReport('sanitize', FAIL, metrics={'raw': '\x1b[31mEMPTY LINE'},
                    evidence='refusal survived\x07 sanitising'),
    ])
    table = run.to_table()

    assert '\x1b' not in table and '\x07' not in table, 'no raw control byte reaches the terminal'
    assert r'\x1b' in table and r'\x07' in table, 'escaped, so the evidence is preserved'
    assert 'EMPTY LINE' in table and 'refusal survived' in table
    assert len(table.splitlines()) == 1

    raw = run.to_json()['stages'][0]
    assert raw['evidence'] == 'refusal survived\x07 sanitising', 'JSON keeps the bytes verbatim'
    assert raw['metrics']['raw'] == '\x1b[31mEMPTY LINE', 'an agent gets what the model really sent'
