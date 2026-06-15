"""In-process status event hub for the Dev console (PRD #279, ADR 016 §Decision 3).

Discrete events (translate triggered, worker registered/lost) are PUSHED to live
`/status/stream` subscribers the instant they happen — no polling loop on the
event tier (the continuous metric tier is sampled separately). Each subscriber
gets its own bounded `asyncio.Queue`; `publish` is sync-callable and
non-blocking, so the translate pipeline can emit an event without awaiting and a
slow consumer can never stall the publisher.
"""
import asyncio


class StatusHub:
    def __init__(self, maxsize: int = 100):
        self._subs: set[asyncio.Queue] = set()
        self._maxsize = maxsize

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=self._maxsize)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    def publish(self, event: dict) -> None:
        """Fan-out to every subscriber, non-blocking. A subscriber whose queue is
        full drops the event (back-pressure on a stuck consumer must not block
        the publisher) — metrics resync the next sample, so a dropped event is at
        worst a missed log line, never a wedged pipeline."""
        for q in self._subs:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    @property
    def subscriber_count(self) -> int:
        return len(self._subs)


# Module-level singleton, alongside task_queue / executor_instances.
status_hub = StatusHub()
