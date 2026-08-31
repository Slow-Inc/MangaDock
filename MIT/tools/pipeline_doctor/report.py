"""The report model every Doctor probe reports through (#686)."""

from dataclasses import dataclass, field
from typing import Dict, List


def _one_line(text: str) -> str:
    r"""Make probe-supplied text safe to print on one terminal row.

    A probe reports what a stage actually produced, and for the LLM stages that is a string the
    *model* wrote. Printed raw it can break the table (a newline splits one stage across two
    rows and destroys the aligned status column) or drive the terminal (`\x1b[2J` clears the
    screen, `\x1b[31m` recolours everything after it, so a FAIL can be dressed up as anything).

    Control characters are escaped rather than stripped: which bytes came back *is* the
    diagnosis, and a Doctor that silently swallows them hides the evidence it exists to show.
    `to_json` is deliberately NOT filtered - JSON encoding already escapes these, and an agent
    should receive exactly what the model sent.
    """
    return ''.join(c if c.isprintable() or c == ' ' else '\\x%02x' % ord(c) for c in text)


#: A probe's verdict. `FAIL` means a contract is broken and the run should stop a gate;
#: `WARN` means a threshold was crossed that is still provisional and must not block work.
OK, WARN, FAIL = 'OK', 'WARN', 'FAIL'


@dataclass
class StageReport:
    """One pipeline stage as a probe saw it."""

    stage: str
    status: str
    metrics: Dict = field(default_factory=dict)
    evidence: str = ''


@dataclass
class DoctorRun:
    """The reports of one page walked through the pipeline, in stage order."""

    reports: List[StageReport] = field(default_factory=list)

    @property
    def failures(self) -> List[str]:
        return [r.stage for r in self.reports if r.status == FAIL]

    @property
    def warnings(self) -> List[str]:
        return [r.stage for r in self.reports if r.status == WARN]

    @property
    def ok(self) -> bool:
        return not self.failures

    @property
    def exit_code(self) -> int:
        return 0 if self.ok else 1

    def to_table(self) -> str:
        """The terminal view: one row per stage, status column aligned so it can be scanned.

        Metrics render as `key=value` and the evidence follows the verdict, because a status
        with no reason next to it is what makes a red run expensive to explain.
        """
        rendered = [(r, _one_line(' '.join(f'{k}={v}' for k, v in r.metrics.items())))
                    for r in self.reports]
        stage_w = max((len(_one_line(r.stage)) for r in self.reports), default=0)
        metric_w = max((len(m) for _, m in rendered), default=0)
        lines = []
        for r, metrics in rendered:
            row = f'{_one_line(r.stage):<{stage_w}}  {metrics:<{metric_w}}  {r.status}'
            if r.evidence:
                row += f'  {_one_line(r.evidence)}'
            lines.append(row)
        return '\n'.join(lines)

    def to_json(self) -> Dict:
        """The agent-facing view of the same data the table renders.

        These keys are a contract: an agent branches on them, so renaming one silently breaks
        every caller. They are documented here and asserted in the tests.

        ==============  =====================================================================
        key             meaning
        ==============  =====================================================================
        ``ok``          ``bool`` — false iff some stage reported ``FAIL``. ``WARN`` keeps it
                        true, because the thresholds behind a ``WARN`` are still provisional.
        ``exit_code``   ``int`` — ``0`` when ``ok``, else ``1``. What a gate branches on.
        ``failures``    stage ids that reported ``FAIL``, in pipeline order.
        ``warnings``    stage ids that reported ``WARN``, in pipeline order.
        ``stages``      every report, in pipeline order, each an object with the four keys
                        below. Stages that did not apply to this page are absent, not blank.
        ==============  =====================================================================

        Each entry of ``stages``:

        ==============  =====================================================================
        key             meaning
        ==============  =====================================================================
        ``stage``       ``str`` — the stage id, e.g. ``vlm-recv``.
        ``status``      ``str`` — one of ``OK`` / ``WARN`` / ``FAIL``.
        ``metrics``     ``dict`` — what the probe measured; JSON-serialisable scalars.
        ``evidence``    ``str`` — why this verdict. ``''`` when the verdict needs no reason.
        ==============  =====================================================================
        """
        return {
            'ok': self.ok,
            'exit_code': self.exit_code,
            'failures': self.failures,
            'warnings': self.warnings,
            'stages': [
                {
                    'stage': r.stage,
                    'status': r.status,
                    'metrics': dict(r.metrics),
                    'evidence': r.evidence,
                }
                for r in self.reports
            ],
        }
