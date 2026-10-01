"""MIT Pipeline Doctor — per-stage inspection reports (#686, part of #685).

One report model, two renderings: a table for a terminal and JSON for an agent. Probes
produce `StageReport`s and register themselves on a `ProbeRegistry`; this package only
collects and renders them, so it never imports the pipeline and stays runnable in the
torch-free `mit_logic` gate.
"""

from .report import FAIL, OK, WARN, DoctorRun, StageReport
from .runner import ProbeRegistry, doctor

__all__ = ['DoctorRun', 'StageReport', 'ProbeRegistry', 'doctor', 'OK', 'WARN', 'FAIL']
