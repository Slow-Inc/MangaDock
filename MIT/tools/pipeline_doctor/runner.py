"""The runner: probes register themselves, the core only orchestrates (#686).

The core must not know what a pipeline stage *is* — that is what keeps this package
torch-free and runnable in the `mit_logic` gate. A probe is any callable that takes the
page under inspection and returns a `StageReport`, or `None` when the stage does not apply
to this page. It attaches itself to a registry; the runner walks the registry in
registration order, which *is* pipeline order, and collects what comes back.
"""

from typing import Any, Callable, List, Optional, Tuple

from .report import FAIL, DoctorRun, StageReport

Probe = Callable[[Any], Optional[StageReport]]


class ProbeRegistry:
    """The seam every later Doctor deliverable plugs into.

    Registration order is pipeline order, deliberately: sorting the stages would print
    `render` before `vlm-send` and describe a pipeline that does not exist.
    """

    def __init__(self) -> None:
        self._probes: List[Tuple[str, Probe]] = []

    def probe(self, stage: str) -> Callable[[Probe], Probe]:
        """Register `stage`'s probe. Used as a decorator, so a probe module registers itself
        on import and the core never holds a list of stages it would have to keep current."""
        def register(fn: Probe) -> Probe:
            self._probes.append((stage, fn))
            return fn
        return register

    def run(self, page: Any = None) -> DoctorRun:
        """Walk every registered probe over one page and collect the reports in order.

        A probe that raises becomes a `FAIL` row carrying the exception as its evidence, and
        the walk continues: a diagnostic that aborts on the first broken stage says nothing
        about the remaining ones, which is exactly when it is most needed.
        """
        reports: List[StageReport] = []
        for stage, fn in self._probes:
            try:
                report = fn(page)
            except Exception as exc:  # a probe crash is a verdict about the stage, not an abort
                report = StageReport(stage, FAIL,
                                     evidence=f'probe raised {type(exc).__name__}: {exc}')
            if report is not None:
                reports.append(report)
        return DoctorRun(reports)


#: The shared registry probe modules attach to by importing this package.
doctor = ProbeRegistry()
