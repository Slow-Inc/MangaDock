"""Unit tests for the in-process status event hub (PRD #279, ADR 016 §Decision 3).

The hub is how discrete events (translate triggered, worker up/down) are PUSHED
to live `/status/stream` subscribers without a polling loop. Pure asyncio +
stdlib, no network/ML — `put_nowait`/`get_nowait` need no running loop on 3.11,
so the tests stay synchronous and sub-second.
"""
import asyncio

from server.status_hub import StatusHub


def test_subscriber_receives_a_published_event():
    hub = StatusHub()
    q = hub.subscribe()
    hub.publish({"type": "event", "kind": "translate_triggered"})
    assert q.get_nowait() == {"type": "event", "kind": "translate_triggered"}


def test_fan_out_to_every_subscriber():
    hub = StatusHub()
    a, b = hub.subscribe(), hub.subscribe()
    hub.publish({"kind": "x"})
    assert a.get_nowait() == {"kind": "x"}
    assert b.get_nowait() == {"kind": "x"}
    assert hub.subscriber_count == 2


def test_unsubscribe_stops_delivery():
    hub = StatusHub()
    q = hub.subscribe()
    hub.unsubscribe(q)
    hub.publish({"kind": "x"})
    assert q.empty()
    assert hub.subscriber_count == 0


def test_full_queue_drops_without_raising():
    # A slow/stuck consumer must never block the publisher (the translate path).
    hub = StatusHub(maxsize=1)
    q = hub.subscribe()
    hub.publish({"n": 1})
    hub.publish({"n": 2})  # dropped for this subscriber, no exception
    assert q.get_nowait() == {"n": 1}
    assert q.empty()


def test_publish_with_no_subscribers_is_a_noop():
    StatusHub().publish({"kind": "x"})  # must not raise
