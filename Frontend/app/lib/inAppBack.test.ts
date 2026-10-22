import { describe, expect, test } from "bun:test";
import { createInAppHistory } from "./inAppBack";

const ORIGIN = "https://mangadock.example";
const router = () => {
  const calls: string[] = [];
  return { calls, back: () => calls.push("back"), push: (href: string) => calls.push(`push ${href}`) };
};

describe("in-app back (#942)", () => {
  test("a page opened directly, from no referrer, goes to its parent", () => {
    const h = createInAppHistory();
    h.notePath("/categories/action");
    const r = router();
    h.goBackOr(r, "/", { referrer: "", origin: ORIGIN });
    expect(r.calls).toEqual(["push /"]);
  });

  test("a page reached from another site also goes to its parent, not back to that site", () => {
    const h = createInAppHistory();
    h.notePath("/community/p/abc");
    const r = router();
    h.goBackOr(r, "/community", { referrer: "https://social.example/feed", origin: ORIGIN });
    expect(r.calls).toEqual(["push /community"]);
  });

  test("after moving between pages inside the app, it goes back", () => {
    const h = createInAppHistory();
    h.notePath("/");
    h.notePath("/categories/action");
    const r = router();
    h.goBackOr(r, "/", { referrer: "", origin: ORIGIN });
    expect(r.calls).toEqual(["back"]);
  });

  test("a same-origin referrer (a full page load from our own page) goes back", () => {
    const h = createInAppHistory();
    h.notePath("/community/p/abc");
    const r = router();
    h.goBackOr(r, "/community", { referrer: `${ORIGIN}/community`, origin: ORIGIN });
    expect(r.calls).toEqual(["back"]);
  });

  test("the same path noted again (a re-render) is not a move", () => {
    const h = createInAppHistory();
    h.notePath("/categories/action");
    h.notePath("/categories/action");
    const r = router();
    h.goBackOr(r, "/", { referrer: "", origin: ORIGIN });
    expect(r.calls).toEqual(["push /"]);
  });

  test("an unparsable referrer counts as none", () => {
    const h = createInAppHistory();
    h.notePath("/x");
    const r = router();
    h.goBackOr(r, "/", { referrer: "not a url", origin: ORIGIN });
    expect(r.calls).toEqual(["push /"]);
  });
});
