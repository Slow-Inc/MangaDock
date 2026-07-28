"""The report model every Doctor probe reports through (#686)."""

from dataclasses import dataclass, field
from typing import Dict, List

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
        stage_w = max((len(r.stage) for r in self.reports), default=0)
        metric_w = 0
        rendered = []
        for r in self.reports:
            metrics = ' '.join(f'{k}={v}' for k, v in r.metrics.items())
            metric_w = max(metric_w, len(metrics))
            rendered.append((r, metrics))
        lines = []
        for r, metrics in rendered:
            row = f'{r.stage:<{stage_w}}  {metrics:<{metric_w}}  {r.status}'
            if r.evidence:
                row += f'  {r.evidence}'
            lines.append(row)
        return '\n'.join(lines)

    def to_json(self) -> Dict:
        """The agent-facing view. These keys are a contract — see the tests."""
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
