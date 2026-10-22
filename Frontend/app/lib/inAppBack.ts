type Router = { back(): void; push(href: string): void };

/**
 * Whether a "back" button can safely go back (#942). A page opened directly — a shared link in a new tab — has no
 * MangaDock page behind it, so `router.back()` would leave the site (or do nothing); `history.length` cannot tell, since
 * a fresh tab already has two entries. Back is safe once the visitor has moved between pages inside the app, or arrived
 * from one of our own pages (a same-origin referrer); otherwise the button goes to its parent page.
 */
export function createInAppHistory() {
  let first: string | null = null;
  let moved = false;
  return {
    /** Called on each route change (book-popup URL changes excluded, as they are not pages). */
    notePath(path: string) {
      if (first === null) first = path;
      else if (path !== first) moved = true;
    },
    goBackOr(router: Router, fallback: string, { referrer, origin }: { referrer: string; origin: string }) {
      let sameOrigin = false;
      try {
        sameOrigin = referrer !== "" && new URL(referrer).origin === origin;
      } catch {
        // not a URL: no usable referrer
      }
      if (moved || sameOrigin) router.back();
      else router.push(fallback);
    },
  };
}

const appHistory = createInAppHistory();

export const notePagePath = appHistory.notePath;

/** `router.back()` when there is a MangaDock page to go back to, otherwise `router.push(fallback)`. */
export function goBackOr(router: Router, fallback: string) {
  appHistory.goBackOr(router, fallback, { referrer: document.referrer, origin: window.location.origin });
}
