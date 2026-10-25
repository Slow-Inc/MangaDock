"""Windows process hygiene for the front and its workers (#1119), ported from Strata-xeno's serve/winjob.py.

- ``no_throttle``: opt a process out of Windows power throttling (EcoQoS). Windows 11 treats a process with a
  hidden or minimized window as background work and, on a hybrid CPU (this PC's i5-13500: 6 P + 8 E cores), moves
  its threads to the E-cores; Strata measured ~20 % slower generation from it (Strata #691).
- ``contain``: put a spawned worker in a kill-on-close job object, so it dies with the front even when the front is
  force-killed (an orphan worker would keep its port and serve stale code).

Both are no-ops returning False off Windows or on failure. Pure ctypes, no ML imports.
"""
import os
import threading

_lock = threading.Lock()
_job = None

if os.name == "nt":
    import ctypes
    from ctypes import wintypes

    _k32 = ctypes.WinDLL("kernel32", use_last_error=True)

    class _BasicLimits(ctypes.Structure):
        _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
                    ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                    ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD), ("SchedulingClass", wintypes.DWORD)]

    class _IoCounters(ctypes.Structure):
        _fields_ = [(n, ctypes.c_uint64) for n in ("ReadOps", "WriteOps", "OtherOps", "ReadBytes", "WriteBytes", "OtherBytes")]

    class _ExtendedLimits(ctypes.Structure):
        _fields_ = [("BasicLimitInformation", _BasicLimits), ("IoInfo", _IoCounters),
                    ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                    ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]

    class _PowerThrottling(ctypes.Structure):
        _fields_ = [("Version", wintypes.ULONG), ("ControlMask", wintypes.ULONG), ("StateMask", wintypes.ULONG)]

    _k32.CreateJobObjectW.restype = wintypes.HANDLE
    _k32.CreateJobObjectW.argtypes = (wintypes.LPVOID, wintypes.LPCWSTR)
    _k32.SetInformationJobObject.argtypes = (wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD)
    _k32.AssignProcessToJobObject.argtypes = (wintypes.HANDLE, wintypes.HANDLE)
    _k32.SetProcessInformation.argtypes = (wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD)
    _k32.GetCurrentProcess.restype = wintypes.HANDLE
    _KILL_ON_JOB_CLOSE = 0x2000
    _EXTENDED_LIMIT_INFORMATION = 9
    _PROCESS_POWER_THROTTLING = 4

    def no_throttle(handle=None) -> bool:
        """EcoQoS off for ``handle`` (default: this process). True when Windows accepted it."""
        handle = _k32.GetCurrentProcess() if handle is None else handle
        for mask in (0x1 | 0x4, 0x1):   # EXECUTION_SPEED + IGNORE_TIMER_RESOLUTION (Win 11), else EXECUTION_SPEED (Win 10)
            info = _PowerThrottling(1, mask, 0)
            if _k32.SetProcessInformation(handle, _PROCESS_POWER_THROTTLING, ctypes.byref(info), ctypes.sizeof(info)):
                return True
        return False

    def _make_job():
        job = _k32.CreateJobObjectW(None, None)
        if not job:
            return None
        info = _ExtendedLimits()
        info.BasicLimitInformation.LimitFlags = _KILL_ON_JOB_CLOSE
        if not _k32.SetInformationJobObject(job, _EXTENDED_LIMIT_INFORMATION, ctypes.byref(info), ctypes.sizeof(info)):
            _k32.CloseHandle(job)
            return None
        return job

    def contain(proc) -> bool:
        """Kill-on-close job + EcoQoS off for a started ``subprocess.Popen``. True when it joined the job."""
        global _job
        if proc is None:
            return False
        with _lock:
            if _job is None:
                _job = _make_job() or 0
            if not _job:
                return False
        try:
            no_throttle(int(proc._handle))
            return bool(_k32.AssignProcessToJobObject(_job, int(proc._handle)))
        except (AttributeError, OSError, ValueError):
            return False
else:
    def no_throttle(handle=None) -> bool:
        return False

    def contain(proc) -> bool:
        return False
