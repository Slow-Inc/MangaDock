/**
 * The check-in "day" as the server sees it. CheckinService keys rows by
 * `new Date().toISOString().slice(0, 10)` — the UTC calendar day — so the
 * modal must use the same key or it reopens/hides on the wrong day for
 * users outside UTC (#665).
 */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** User-facing reason a POST /checkin claim failed; `null` = network error. */
export function checkinErrorMessage(status: number | null): string {
  if (status === null) return "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง";
  if (status === 409) return "วันนี้เช็คอินไปแล้ว";
  return "รับเหรียญไม่สำเร็จ ลองใหม่อีกครั้ง";
}
