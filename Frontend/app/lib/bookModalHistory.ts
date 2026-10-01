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

/** The id of a /book/<id> popup path; null for any other route (incl. /book/<id>/reviews). */
export function bookIdFromPath(pathname: string): string | null {
  const m = /^\/book\/([^/]+)\/?$/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

const open: object[] = [];

/** Popups can nest (a related book opened inside a book). Each pushes its own history
 *  entry, so only the top-most one may answer a Back press. */
export const modalStack = {
  push(token: object) {
    open.push(token);
  },
  remove(token: object) {
    const i = open.indexOf(token);
    if (i !== -1) open.splice(i, 1);
  },
  isTop(token: object) {
    return open[open.length - 1] === token;
  },
};

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
