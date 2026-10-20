/**
 * Payload of the `mb:coin-balance-update` window event the navbar coin chip
 * listens to. `balance` is the authoritative new total; `delta` is a known
 * credit used when the total could not be refetched (#670).
 */
export type CoinBalanceUpdate = { balance?: number; delta?: number };

export function applyCoinBalanceUpdate(prev: number | null, detail: CoinBalanceUpdate): number | null {
  if (typeof detail.balance === "number") return detail.balance;
  if (typeof detail.delta === "number" && prev !== null) return prev + detail.delta;
  return prev;
}
