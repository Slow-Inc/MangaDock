import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";

/**
 * The popup <-> history plumbing. Each test imports its own module instance (it keeps a
 * module-level stack and installs one window popstate listener) and a fake window whose
 * history.back() fires popstate asynchronously, as a browser does.
 */
let popstateListeners: Set<() => void>;
let instance = 0;

const firePopstate = () => [...popstateListeners].forEach((l) => l());

async function fresh() {
  return await import(`./bookModalHistory.ts?case=${++instance}`);
}

beforeEach(() => {
  popstateListeners = new Set();
  jest.useFakeTimers();
  Object.assign(globalThis, {
    window: {
      addEventListener: (type: string, fn: () => void) => type === "popstate" && popstateListeners.add(fn),
      removeEventListener: (type: string, fn: () => void) => type === "popstate" && popstateListeners.delete(fn),
      history: { back: () => void setTimeout(firePopstate, 0) },
    },
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** A fake popup: `handles` is whether it still owns an unpopped history entry. */
const popup = (handles = true) => {
  const p = {
    backs: 0,
    onBack() {
      if (!handles) return false;
      p.backs++;
      handles = false; // its entry is popped now, like BookDetailModal's historyPushedRef
      return true;
    },
  };
  return p;
};

describe("bookPath", () => {
  test("builds /book/<id>", async () => {
    const { bookPath } = await fresh();
    expect(bookPath("abc-123")).toBe("/book/abc-123");
  });

  test("keeps the current query string so pages behind that read it (search, community, mylist) still see it", async () => {
    const { bookPath } = await fresh();
    expect(bookPath("abc", "?q=Lout%20of%20Count&page=2")).toBe("/book/abc?q=Lout%20of%20Count&page=2");
  });

  test("encodes ids that are not url-safe", async () => {
    const { bookPath } = await fresh();
    expect(bookPath("a b/c")).toBe("/book/a%20b%2Fc");
  });
});

describe("modalStack: a Back press goes to the top-most popup that still owns a history entry", () => {
  test("only the top-most popup answers", async () => {
    const { modalStack } = await fresh();
    const a = popup();
    const b = popup();
    modalStack.push(a);
    modalStack.push(b);

    firePopstate();

    expect([a.backs, b.backs]).toEqual([0, 1]);
  });

  test("a second Back reaches the popup underneath once the top one has taken its entry", async () => {
    const { modalStack } = await fresh();
    const a = popup();
    const b = popup();
    modalStack.push(a);
    modalStack.push(b);

    firePopstate();
    firePopstate();

    expect([a.backs, b.backs]).toEqual([1, 1]);
  });

  test("a popup removed (unmounted) hands Back to the one underneath", async () => {
    const { modalStack } = await fresh();
    const a = popup();
    const b = popup();
    modalStack.push(a);
    modalStack.push(b);
    modalStack.remove(b);

    firePopstate();

    expect([a.backs, b.backs]).toEqual([1, 0]);
  });

  test("isTop reports the most recently opened popup; unknown or removed popups are never on top", async () => {
    const { modalStack } = await fresh();
    const a = popup();
    const b = popup();
    expect(modalStack.isTop(a)).toBe(false);
    modalStack.push(a);
    modalStack.push(b);
    expect(modalStack.isTop(b)).toBe(true);
    expect(modalStack.isTop(a)).toBe(false);
    modalStack.remove(b);
    expect(modalStack.isTop(a)).toBe(true);
    modalStack.remove(b); // removing twice is harmless
  });
});

describe("backOwnEntry: a popup closing its own history entry is not a Back press", () => {
  test("the popstate it causes is swallowed even after the popup is already unmounted (closing a nested popup with X must not close the one under it)", async () => {
    const { modalStack, backOwnEntry } = await fresh();
    const outer = popup();
    const inner = popup();
    modalStack.push(outer);
    modalStack.push(inner);

    // inner's close path: take its entry back, then unmount (React removes it from the stack)
    backOwnEntry();
    modalStack.remove(inner);
    jest.advanceTimersByTime(10); // the browser's popstate arrives now

    expect(outer.backs).toBe(0);
  });

  test("a real Back press right after an own back still reaches the popup", async () => {
    const { modalStack, backOwnEntry } = await fresh();
    const outer = popup();
    modalStack.push(outer);

    backOwnEntry();
    jest.advanceTimersByTime(10); // swallowed
    firePopstate(); // the user pressed Back

    expect(outer.backs).toBe(1);
  });
});

describe("modal navigation marker (lets SmoothScrolling skip its scroll-to-top)", () => {
  test("true shortly after a popup opened or closed, false before any and after the window", async () => {
    const { isModalNavigation, markModalNavigation } = await fresh();
    expect(isModalNavigation(5_000)).toBe(false);
    markModalNavigation(10_000);
    expect(isModalNavigation(10_500)).toBe(true);
    expect(isModalNavigation(11_500)).toBe(false);
  });
});
