import { describe, expect, test } from "bun:test";
import { checkinErrorMessage, utcDayKey } from "./dailyCheckin";

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

describe("checkinErrorMessage", () => {
  test("network failure (no status) asks to retry the connection", () => {
    expect(checkinErrorMessage(null)).toBe("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
  });

  test("401 asks the user to sign in again", () => {
    expect(checkinErrorMessage(401)).toBe("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  });

  test("409 says today's check-in was already claimed", () => {
    expect(checkinErrorMessage(409)).toBe("วันนี้เช็คอินไปแล้ว");
  });

  test("any other status is a generic retryable failure", () => {
    expect(checkinErrorMessage(500)).toBe("รับเหรียญไม่สำเร็จ ลองใหม่อีกครั้ง");
  });
});
