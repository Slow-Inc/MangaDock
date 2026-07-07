import { describe, it, expect } from "bun:test";
import { createModalTransition, type ModalSchedulers } from "./useModalTransition";

/**
 * Fake scheduler that records every raf/timeout registration and every
 * setVisible/setMounted/clearTimer/cancelRaf call, and lets the test fire
 * pending callbacks synchronously by the id the fake handed back.
 */
function createFakeSchedulers() {
  let nextRafId = 0;
  let nextTimerId = 0;
  const rafCallbacks = new Map<number, () => void>();
  const timerCallbacks = new Map<number, () => void>();

  const rafCalls: number[] = []; // ids in the order raf() was invoked
  const timeoutCalls: { id: number; ms: number }[] = [];
  const cancelRafCalls: number[] = [];
  const clearTimerCalls: number[] = [];
  const setVisibleCalls: boolean[] = [];
  const setMountedCalls: boolean[] = [];
  /** Interleaved log of setVisible/setMounted/onClosed for ordering assertions. */
  const events: string[] = [];

  const schedulers: ModalSchedulers = {
    raf: (cb) => {
      const id = ++nextRafId;
      rafCallbacks.set(id, cb);
      rafCalls.push(id);
      return id;
    },
    cancelRaf: (id) => {
      cancelRafCalls.push(id);
      rafCallbacks.delete(id);
    },
    timeout: (cb, ms) => {
      const id = ++nextTimerId;
      timerCallbacks.set(id, cb);
      timeoutCalls.push({ id, ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (id) => {
      clearTimerCalls.push(id as unknown as number);
      timerCallbacks.delete(id as unknown as number);
    },
    setVisible: (v) => {
      setVisibleCalls.push(v);
      events.push(`setVisible:${v}`);
    },
    setMounted: (m) => {
      setMountedCalls.push(m);
      events.push(`setMounted:${m}`);
    },
  };

  return {
    schedulers,
    rafCalls,
    timeoutCalls,
    cancelRafCalls,
    clearTimerCalls,
    setVisibleCalls,
    setMountedCalls,
    events,
    fireRaf(id: number) {
      const cb = rafCallbacks.get(id);
      rafCallbacks.delete(id);
      cb?.();
    },
    fireTimer(id: number) {
      const cb = timerCallbacks.get(id);
      timerCallbacks.delete(id);
      cb?.();
    },
  };
}

describe("createModalTransition", () => {
  it("enter() double-rAF: setVisible(true) fires only after both frames", () => {
    const fake = createFakeSchedulers();
    const core = createModalTransition(fake.schedulers, 300);

    core.enter();
    expect(fake.rafCalls.length).toBe(1); // only the first frame scheduled so far
    expect(fake.setVisibleCalls.length).toBe(0);

    fake.fireRaf(fake.rafCalls[0]);
    // firing the first frame schedules the second — setVisible must not have fired yet
    expect(fake.rafCalls.length).toBe(2);
    expect(fake.setVisibleCalls.length).toBe(0);

    fake.fireRaf(fake.rafCalls[1]);
    expect(fake.setVisibleCalls).toEqual([true]);
  });

  it("close() sets visible false immediately and schedules a timeout with the given duration", () => {
    const fake = createFakeSchedulers();
    const core = createModalTransition(fake.schedulers, 250);

    core.close();
    expect(fake.setVisibleCalls).toEqual([false]);
    expect(fake.timeoutCalls.length).toBe(1);
    expect(fake.timeoutCalls[0].ms).toBe(250);
    expect(fake.setMountedCalls).toEqual([]); // timer hasn't fired yet
  });

  it("firing the exit timer calls setMounted(false) then onClosed, in that order", () => {
    const fake = createFakeSchedulers();
    const onClosed = () => fake.events.push("onClosed");
    const core = createModalTransition(fake.schedulers, 250, onClosed);

    core.close();
    fake.fireTimer(fake.timeoutCalls[0].id);

    expect(fake.setMountedCalls).toEqual([false]);
    const mountedIdx = fake.events.indexOf("setMounted:false");
    const closedIdx = fake.events.indexOf("onClosed");
    expect(mountedIdx).toBeGreaterThanOrEqual(0);
    expect(closedIdx).toBeGreaterThan(mountedIdx);
  });

  it("close() called twice clears the previous exit timer before scheduling a new one", () => {
    const fake = createFakeSchedulers();
    const core = createModalTransition(fake.schedulers, 300);

    core.close();
    const firstTimerId = fake.timeoutCalls[0].id;
    expect(fake.clearTimerCalls).toEqual([]); // nothing to clear yet

    core.close();
    expect(fake.clearTimerCalls).toEqual([firstTimerId]);
    expect(fake.timeoutCalls.length).toBe(2); // a new timer was scheduled
  });

  it("cleanup() cancels both pending rAFs and any pending exit timer", () => {
    const fake = createFakeSchedulers();
    const core = createModalTransition(fake.schedulers, 300);

    core.enter();
    fake.fireRaf(fake.rafCalls[0]); // schedules the second raf; both ids now exist
    core.close(); // schedules the exit timer

    core.cleanup();

    expect(fake.cancelRafCalls).toEqual(fake.rafCalls); // both raf ids canceled
    expect(fake.clearTimerCalls).toEqual([fake.timeoutCalls[0].id]);
  });

  it("close() with no onClosed does not throw when the timer fires", () => {
    const fake = createFakeSchedulers();
    const core = createModalTransition(fake.schedulers, 300);

    core.close();
    expect(() => fake.fireTimer(fake.timeoutCalls[0].id)).not.toThrow();
    expect(fake.setMountedCalls).toEqual([false]);
  });
});
