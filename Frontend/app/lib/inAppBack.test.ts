import { describe, expect, test } from "bun:test";
import { createInAppBack } from "./inAppBack";

/** A stand-in for window.history: one current entry whose state replaceState overwrites. */
const fakeHistory = (state: unknown = null) => ({
  state,
  replaceState(data: unknown) { this.state = data; },
});
const router = () => {
  const calls: string[] = [];
  return { calls, back: () => calls.push("back"), push: (href: string) => calls.push(`push ${href}`) };
};

describe("in-app back (#942)", () => {
  test("on the entry the visitor landed on (a direct link, a new tab), back goes to the parent page", () => {
    const h = fakeHistory({ __NA: true });
    const nav = createInAppBack(h);
    nav.markLanding();
    const r = router();
    nav.goBackOr(r, "/community");
    expect(r.calls).toEqual(["push /community"]);
  });

  test("marking keeps the router's own state on the entry", () => {
    const h = fakeHistory({ __NA: true, tree: "t" });
    createInAppBack(h).markLanding();
    expect(h.state).toMatchObject({ __NA: true, tree: "t" });
  });

  test("on any later entry (reached inside the app), back goes back", () => {
    const h = fakeHistory({ __NA: true });
    const nav = createInAppBack(h);
    nav.markLanding();
    h.state = { __NA: true }; // a client navigation pushed a new, unmarked entry
    const r = router();
    nav.goBackOr(r, "/");
    expect(r.calls).toEqual(["back"]);
  });

  test("only the first page of the document is the landing: later marks are ignored", () => {
    const h = fakeHistory({});
    const nav = createInAppBack(h);
    nav.markLanding();
    h.state = { __NA: true };
    nav.markLanding();
    const r = router();
    nav.goBackOr(r, "/");
    expect(r.calls).toEqual(["back"]);
  });

  test("a null history state is handled", () => {
    const h = fakeHistory(null);
    const nav = createInAppBack(h);
    nav.markLanding();
    const r = router();
    nav.goBackOr(r, "/");
    expect(r.calls).toEqual(["push /"]);
  });
});
