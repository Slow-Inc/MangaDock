import { clearUserCache } from "./userCache";
import { resetHistoryForIdentityChange } from "./readingHistory";
import { clearFollowCache } from "../hooks/useSeriesFollow";
import { clearAllApiCache } from "./apiCache";

/**
 * The signed-in identity changed (sign-out, account switch, account deleted): drop
 * everything this browser holds for the previous user — favourites / likes, reading
 * history, the follow list and the API response cache — so nothing bleeds into the next
 * session. Local only: it never writes to the server.
 *
 * Every per-user client cache belongs in this list. It used to be written out by hand at
 * four call sites in AuthContext, which is how the follow cache was added late.
 */
export function resetClientStateForIdentityChange(): void {
  clearUserCache();
  resetHistoryForIdentityChange();
  clearFollowCache();
  clearAllApiCache();
}
