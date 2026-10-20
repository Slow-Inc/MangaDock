import { describe, expect, test } from "bun:test";
import { utcDayKey } from "./dailyCheckin";

// The backend keys a check-in by the UTC calendar day
// (`new Date().toISOString().slice(0, 10)` in checkin.service.ts), so the
// modal's "already handled today" marker must roll over at 07:00 Bangkok time.
describe("utcDayKey", () => {
  test("late evening in Bangkok is still the same UTC day", () => {
    expect(utcDayKey(new Date("2026-10-20T23:30:00+07:00"))).toBe("2026-10-20");
  });

  test("just before 07:00 Bangkok is still the previous UTC day", () => {
    expect(utcDayKey(new Date("2026-10-21T06:59:00+07:00"))).toBe("2026-10-20");
  });

  test("07:00 Bangkok is the start of the next UTC day", () => {
    expect(utcDayKey(new Date("2026-10-21T07:00:00+07:00"))).toBe("2026-10-21");
  });
});
