/**
 * URL <-> book popup plumbing. The popup (BookDetailModal) pushes /book/<id> as a real
 * history entry while it is open, so the address bar is shareable and Back closes it,
 * while the page it was opened over stays mounted behind it.
 */

/** `search` (the current `location.search`) is kept so pages behind the popup that read
 *  their query from the URL (search, community, mylist, ...) still see it. */
export function bookPath(id: string, search = ""): string {
  return `/book/${encodeURIComponent(id)}${search}`;
}

/** A popup as the history listener sees it. `onBack` takes the popup's history entry and
 *  starts its close; it returns false when the popup has no entry left to give (already
 *  closing, or opened by a direct link) so the Back goes to the popup underneath. */
export type Popup = { onBack: () => boolean };

const open: Popup[] = [];
let ownBacks = 0;
let listening = false;

function onPopState() {
  // The popstate of a history.back() a popup made for its OWN entry is not a Back press.
  if (ownBacks > 0) {
    ownBacks--;
    return;
  }
  for (let i = open.length - 1; i >= 0; i--) if (open[i].onBack()) return;
}

/** Popups can nest (a related book opened inside a book), and each pushes its own history
 *  entry. One window listener (not one per popup) routes a Back press to the top-most popup
 *  that still owns an entry — it stays correct however React orders unmounts against the
 *  browser's asynchronous popstate. */
export const modalStack = {
  push(popup: Popup) {
    open.push(popup);
    if (!listening) {
      window.addEventListener("popstate", onPopState);
      listening = true;
    }
  },
  remove(popup: Popup) {
    const i = open.indexOf(popup);
    if (i !== -1) open.splice(i, 1);
  },
  isTop(popup: Popup) {
    return open[open.length - 1] === popup;
  },
  /** Whether any book popup is open — the hero carousel holds still behind one (#948). */
  anyOpen() {
    return open.length > 0;
  },
};

/** A popup closing its own history entry (X, Escape, backdrop). The popstate this causes is
 *  swallowed: by the time it arrives the popup may be unmounted, and the popup underneath
 *  must not read it as a Back press and close too. */
export function backOwnEntry() {
  ownBacks++;
  window.history.back();
}

type LinkClick = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean };

/** The in-app path a click inside a popup navigates to, or null to leave the click to the
 *  browser / Next. A popup that pushed /book/<id> must REPLACE that entry when a link takes
 *  the user elsewhere: a push leaves /book/<id> behind, and Back then shows the page behind
 *  at /book/<id> with no popup. */
export function inPopupLinkTarget(
  a: { getAttribute(name: string): string | null } | null,
  e: LinkClick,
): string | null {
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const href = a.getAttribute("href");
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  if (a.getAttribute("target") === "_blank" || a.getAttribute("download") !== null) return null;
  return href;
}

let lastModalNavigation = Number.NEGATIVE_INFINITY;

/** Called right before a popup opens/closes its history entry. */
export function markModalNavigation(now = Date.now()) {
  lastModalNavigation = now;
}

/** True when the pathname that just changed was caused by a popup, not a page navigation
 *  (SmoothScrolling resets scroll to the top on every pathname change and must skip it,
 *  or the page behind the popup would jump to the top). */
export function isModalNavigation(now = Date.now(), windowMs = 1000) {
  return now - lastModalNavigation < windowMs;
}
