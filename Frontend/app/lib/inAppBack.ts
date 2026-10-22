type Router = { back(): void; push(href: string): void };
type HistoryLike = { state: unknown; replaceState(data: unknown, unused: string): void };

/** Key on the history entry the visitor landed on; it stays with that entry through browser back and reloads. */
const LANDING = "mangadockLanding";

/**
 * Whether a "back" button can safely go back (#942). On the entry the visitor landed on — a shared link, a link opened
 * in a new tab — there is no MangaDock page behind it, so `router.back()` would leave the site or do nothing
 * (`history.length` cannot tell: a fresh tab already has two entries). That entry is marked when the document's first
 * page renders; back buttons push their parent page there and go back everywhere else.
 */
export function createInAppBack(history: HistoryLike) {
  let marked = false;
  return {
    markLanding() {
      if (marked) return;
      marked = true;
      const state = history.state && typeof history.state === "object" ? history.state : {};
      history.replaceState({ ...state, [LANDING]: true }, "");
    },
    goBackOr(router: Router, fallback: string) {
      const state = history.state as Record<string, unknown> | null;
      if (state?.[LANDING]) router.push(fallback);
      else router.back();
    },
  };
}

let appBack: ReturnType<typeof createInAppBack> | null = null;
const inAppBack = () => (appBack ??= createInAppBack(window.history));

/** Marks the current history entry as where the visitor landed — once per document (SmoothScrolling, first render). */
export const markLandingPage = () => inAppBack().markLanding();

/** `router.back()` when there is a MangaDock page to go back to, otherwise `router.push(fallback)`. */
export const goBackOr = (router: Router, fallback: string) => inAppBack().goBackOr(router, fallback);
