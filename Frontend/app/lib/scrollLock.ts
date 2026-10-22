/**
 * Locks the page's scroll while any layer (the reader, the book popup) holds it (#936). Each `lock()` returns its own
 * release; the page unlocks only when the last holder has released, so the reader closing does not unlock the popup
 * still open underneath. A release counts once, however often it is called. `onChange` hears each switch between
 * locked and unlocked — the app's smooth-scroll engine drives the page itself and must stop too.
 */
export function createScrollLock(style: { overflow: string }, onChange?: (locked: boolean) => void) {
  let holders = 0;
  return function lock(): () => void {
    if (holders++ === 0) {
      style.overflow = "hidden";
      onChange?.(true);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--holders === 0) {
        style.overflow = "";
        onChange?.(false);
      }
    };
  };
}

let pageLock: (() => () => void) | null = null;
let pageLocked = false;
let listener: ((locked: boolean) => void) | null = null;

/**
 * Locks the page's scroll; call the returned function to release (in an effect's cleanup). The lock is on `<html>`, not
 * `<body>`: the login modals still write `body.style.overflow` themselves, and with `<html>` hidden that no longer
 * controls the viewport, so closing one cannot unlock the page under an open popup.
 */
export function lockPageScroll(): () => void {
  pageLock ??= createScrollLock(document.documentElement.style, (locked) => {
    pageLocked = locked;
    listener?.(locked);
  });
  return pageLock();
}

/** The smooth-scroll engine's hook: told when the page locks and unlocks (now, if it is locked already). */
export function onPageScrollLock(fn: (locked: boolean) => void): () => void {
  listener = fn;
  if (pageLocked) fn(true);
  return () => {
    if (listener === fn) listener = null;
  };
}
