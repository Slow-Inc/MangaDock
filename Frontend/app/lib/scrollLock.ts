/**
 * Locks the page's scroll while any layer (the reader, the book popup) holds it (#936). Each `lock()` returns its own
 * release; the page unlocks only when the last holder has released, so the reader closing does not unlock the popup
 * still open underneath. A release counts once, however often it is called.
 */
export function createScrollLock(style: { overflow: string }) {
  let holders = 0;
  return function lock(): () => void {
    holders++;
    style.overflow = "hidden";
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holders--;
      if (holders === 0) style.overflow = "";
    };
  };
}

let pageLock: (() => () => void) | null = null;

/** Locks `document.body` scroll; call the returned function to release (in an effect's cleanup). */
export function lockPageScroll(): () => void {
  pageLock ??= createScrollLock(document.body.style);
  return pageLock();
}
