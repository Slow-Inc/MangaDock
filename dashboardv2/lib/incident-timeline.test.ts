import { test, expect } from "bun:test";
import { tickFromLive, pushTick, summarize } from "./incident-timeline";
import { MOCK_MIT } from "./mock-live";

test("tickFromLive marks degraded mock as not-ok", () => {
  const t = tickFromLive(MOCK_MIT, 1000)!;
  expect(t.status).toBe("degraded");
  expect(t.ok).toBe(false);
});

test("tickFromLive treats up/ok as healthy, null → null", () => {
  expect(tickFromLive({ ...MOCK_MIT, status: "up" }, 1)!.ok).toBe(true);
  expect(tickFromLive({ ...MOCK_MIT, status: "ok" }, 1)!.ok).toBe(true);
  expect(tickFromLive(null, 1)).toBeNull();
});

test("pushTick dedupes same-status within the min gap, keeps real transitions", () => {
  let buf: ReturnType<typeof pushTick> = [];
  buf = pushTick(buf, { at: 0, status: "up", ok: true });
  buf = pushTick(buf, { at: 1000, status: "up", ok: true }); // within 5s, same status → skipped
  expect(buf.length).toBe(1);
  buf = pushTick(buf, { at: 2000, status: "down", ok: false }); // transition → always lands
  expect(buf.length).toBe(2);
  buf = pushTick(buf, { at: 9000, status: "down", ok: false }); // same status but > gap → lands
  expect(buf.length).toBe(3);
});

test("pushTick caps the ring buffer (oldest dropped)", () => {
  let buf: ReturnType<typeof pushTick> = [];
  for (let i = 0; i < 100; i++) buf = pushTick(buf, { at: i * 10000, status: i % 2 ? "up" : "down", ok: !!(i % 2) }, 10);
  expect(buf.length).toBe(10);
  expect(buf[buf.length - 1].at).toBe(99 * 10000);
});

test("summarize counts degraded + okPct", () => {
  const buf = [
    { at: 0, status: "up", ok: true },
    { at: 1, status: "down", ok: false },
    { at: 2, status: "up", ok: true },
    { at: 3, status: "up", ok: true },
  ];
  const s = summarize(buf);
  expect(s.total).toBe(4);
  expect(s.degraded).toBe(1);
  expect(s.okPct).toBe(75);
  expect(summarize([]).okPct).toBe(100);
});
