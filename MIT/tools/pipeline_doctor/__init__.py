"""MIT Pipeline Doctor — per-stage inspection reports (#686, part of #685).

One report model, two renderings: a table for a terminal and JSON for an agent. Probes
produce `StageReport`s; this package only collects and renders them, so it never imports the
pipeline and stays runnable in the torch-free `mit_logic` gate.
"""

from .report import FAIL, OK, WARN, DoctorRun, StageReport

__all__ = ['DoctorRun', 'StageReport', 'OK', 'WARN', 'FAIL']
