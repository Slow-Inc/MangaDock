# Post-mortem — MIT front queue dropped a waiting request under concurrency (2026-10-25)

## Required inputs
- [x] **Reliable repro** — `MIT/test/test_queue_race.py::test_task_removed_during_update_event_stays_removed`
  (deterministic); live: 10 pages sent at once to 4 workers.
- [x] **Root cause known** — iterator shift in `TaskQueue.update_event` (below).
- [x] **Fix identified** — commit `72ec1053` on `fix/mit-worker-transport` (#1119).
- [x] **Fix validated** — the test is green; the same 10-page batch on 4 workers went 8/10 → 10/10.

---

**Summary** — When several pages were sent to MIT at once, some requests failed immediately with HTTP 500
("User is no longer connected") before any worker saw them: 2/10 pages in a 4-worker batch, and the unexplained
"0.03 s failures" of the 2026-10-25 Phase B run. `TaskQueue.update_event` rebuilt the queue while awaiting
disconnect checks over the live list; a concurrent dispatch removed an element mid-iteration and a still-waiting
request fell out of the queue. Fixed by awaiting on a snapshot and filtering the live list without awaiting.
Issue #1119.

**Symptom** — `tmp/mit_bench.py --concurrency 10` against 4 workers: two pages returned in 0.07–0.08 s; the
front log showed `POST /translate/with-form/image HTTP/1.1" 500` with no worker log activity. Not reproduced with
1 or 2 workers at 4 concurrent requests (two runs, all 200) — the race needs a dispatch to land during another
request's disconnect check.

**Root cause** — `MIT/server/myqueue.py`, `TaskQueue.update_event`:

```python
self.queue = [task for task in self.queue if not await task.is_client_disconnected()]
```

The comprehension iterates the **live** `self.queue` and yields at each `await`. `wait_in_queue` dispatches a task
and calls `task_queue.remove(task)` (another coroutine) while that iteration is suspended. Removing index 0 shifts
every element left, so the iterator skips the next one: that task is missing from the rebuilt list, and the task
that was just removed is still in it. The skipped request's next `task_queue.get_pos(task)` returns `None`, and
`wait_in_queue` raises `HTTPException(500, "User is no longer connected")`.

**Why it produced the symptom** — the 500 message names a disconnected client, so it read as a client problem;
the client was connected the whole time.

**Fix** — commit `72ec1053`:

```python
gone = [task for task in list(self.queue) if await task.is_client_disconnected()]
self.queue = [task for task in self.queue if task not in gone]
```

The awaits run over a snapshot; the live list is filtered in one synchronous step, so neither a concurrent
`remove()` nor an `add_task()` can be lost or resurrected.

**How it was found** — the Phase B failure was first parked as no-repro (4 concurrent requests on 1 and 2 workers
all succeeded). It reappeared in the 4-worker batch arm. The front logged a 500 with no worker activity, so the
failure was inside `wait_in_queue` before dispatch; of its two 500 paths, `get_pos(...) is None` is the one a
queued request can hit without disconnecting. A unit test that removes an element during `update_event` failed
with `['a']` where `['b']` was expected — the removed task resurrected and the waiting one gone.

**Why it slipped through** — latent since the queue was written: with one worker, at most one dispatch happens at
a time and requests rarely overlap a disconnect check. Multi-worker (#1118) made concurrent dispatch normal.
No test exercised `update_event` with concurrent mutation.

**Validation** — `test_queue_race.py`: 3 tests (task added during the check is kept; disconnected tasks are
dropped; task removed during the check stays removed), red before the fix on the third, green after. Live:
v1 4-worker batch 8/10 → v2 4-worker batch 10/10, and 5-worker batches 10/10 (two runs). Coverage: one
machine, one gateway; not load-tested beyond 10 concurrent requests.

**Action items** — None — the fix is sufficient.
