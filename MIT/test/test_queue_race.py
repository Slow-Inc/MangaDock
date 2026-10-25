"""#1119: TaskQueue.update_event must not lose or resurrect tasks while it awaits the disconnect checks.

Reproduces the instant HTTP 500s ("User is no longer connected", 0.03-0.08 s) seen when 10 pages are
sent at once to 4 workers: update_event iterated the live queue across awaits, a concurrent remove()
(another request being dispatched) shifted the iterator, the next waiting task was skipped out of the
rebuilt queue, and the removed task was written back. The add case passed before the fix too; it guards
against a snapshot-only rewrite that would drop late arrivals.
"""
import asyncio

from server.myqueue import TaskQueue


class _Task:
    def __init__(self, name, disconnected=False):
        self.name = name
        self.disconnected = disconnected

    async def is_client_disconnected(self):
        await asyncio.sleep(0)  # a real Request.is_disconnected() yields to the loop
        return self.disconnected


def _queue(*tasks):
    q = TaskQueue()
    q.queue = list(tasks)
    return q


def test_task_added_during_update_event_is_kept():
    async def main():
        q = _queue(_Task('a'), _Task('b'))
        late = _Task('late')
        updating = asyncio.ensure_future(q.update_event())
        await asyncio.sleep(0)       # update_event is now awaiting a disconnect check
        q.queue.append(late)         # what add_task does for a request arriving right now
        await updating
        return [t.name for t in q.queue]
    assert asyncio.run(main()) == ['a', 'b', 'late']


def test_disconnected_tasks_are_still_dropped():
    async def main():
        q = _queue(_Task('a'), _Task('gone', disconnected=True), _Task('c'))
        await q.update_event()
        return [t.name for t in q.queue]
    assert asyncio.run(main()) == ['a', 'c']


def test_task_removed_during_update_event_stays_removed():
    async def main():
        a, b = _Task('a'), _Task('b')
        q = _queue(a, b)
        updating = asyncio.ensure_future(q.update_event())
        await asyncio.sleep(0)
        q.queue.remove(a)            # another request was dispatched meanwhile
        await updating
        return [t.name for t in q.queue]
    assert asyncio.run(main()) == ['b']


def test_waiting_task_is_not_skipped_when_another_is_dispatched():
    # The production symptom: [a, b, c], a is dispatched mid-check -> b vanished before the fix ([a, c]).
    async def main():
        a, b, c = _Task('a'), _Task('b'), _Task('c')
        q = _queue(a, b, c)
        updating = asyncio.ensure_future(q.update_event())
        await asyncio.sleep(0)
        q.queue.remove(a)
        await updating
        return [t.name for t in q.queue]
    assert asyncio.run(main()) == ['b', 'c']
