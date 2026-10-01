"""Unit tests for server.telemetry_store — the parent-side sink the worker reports
pipeline telemetry into (per-stage durations + a VRAM report: global torch
allocated/reserved plus per-model footprint & leak flags) so the Dev-console /status
snapshot shows real data. Pure / stdlib, runs in <1s."""

from server.telemetry_store import TelemetryStore


def test_empty_store_snapshot_is_blank():
    assert TelemetryStore().snapshot() == {"stages": [], "vram": None}


def test_record_stage_averages_recent_durations():
    st = TelemetryStore()
    st.record_stage("translate", 100)
    st.record_stage("translate", 200)
    assert st.snapshot()["stages"] == [{"id": "translate", "label": "Translate", "live_ms": 150}]


def test_stage_label_falls_back_to_the_id_for_unknown_stages():
    st = TelemetryStore()
    st.record_stage("upscale", 42)
    assert st.snapshot()["stages"][0] == {"id": "upscale", "label": "upscale", "live_ms": 42}


def test_stage_durations_roll_off_after_keep():
    st = TelemetryStore(keep=3)
    for ms in (1000, 10, 20, 30):  # 1000 evicted → avg of (10,20,30)=20
        st.record_stage("ocr", ms)
    assert st.snapshot()["stages"][0]["live_ms"] == 20


def test_record_vram_keeps_the_last_report():
    st = TelemetryStore()
    st.record_vram({"allocated_mb": 5000, "reserved_mb": 6000,
                    "models": [{"model": "ocr", "footprint_mb": 2400, "freed_mb": 2390, "leaked": False}]})
    v = st.snapshot()["vram"]
    assert v["allocated_mb"] == 5000 and v["reserved_mb"] == 6000
    assert v["models"][0]["leaked"] is False


def test_apply_stage_records_and_returns_an_event():
    st = TelemetryStore()
    ev = st.apply({"kind": "stage", "stage": "translate", "ms": 3200})
    assert ev == {"type": "event", "service": "mit", "kind": "stage", "detail": "Translate 3200ms"}
    assert st.snapshot()["stages"][0]["live_ms"] == 3200


def test_apply_vram_stores_the_report_and_emits_no_event():
    st = TelemetryStore()
    report = {"allocated_mb": 7000, "reserved_mb": 8000, "models": [{"model": "detect", "footprint_mb": 1100, "freed_mb": 0, "leaked": True}]}
    assert st.apply({"kind": "vram", **report}) is None
    assert st.snapshot()["vram"] == report


def test_apply_ignores_malformed_or_unknown_messages():
    st = TelemetryStore()
    assert st.apply({"kind": "stage", "stage": "ocr"}) is None  # missing ms
    assert st.apply({"kind": "bogus"}) is None
    assert st.apply({}) is None
    assert st.snapshot() == {"stages": [], "vram": None}
